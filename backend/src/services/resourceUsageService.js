const fs = require('fs');
const path = require('path');
const { statfs } = require('fs/promises');
const db = require('../utils/db');

function bytesToMbInt(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return 0;
  return Math.max(0, Math.round(bytes / (1024 * 1024)));
}

function clampInt(n, min, max) {
  const x = Number.isFinite(n) ? Math.round(n) : 0;
  return Math.max(min, Math.min(max, x));
}

function safeStatSize(absPath) {
  try {
    const st = fs.statSync(absPath);
    return st.isFile() ? st.size : 0;
  } catch {
    return 0;
  }
}

function tryAbsFromPublicUrl(url) {
  if (!url) return null;
  const u = String(url).trim();
  if (!u.startsWith('/api/uploads/')) return null;
  const rel = u.replace('/api/uploads/', '');
  return path.join(__dirname, '../../', 'uploads', rel);
}

function sumUrlsBytes(urls) {
  let total = 0;
  for (const u of urls || []) {
    const abs = tryAbsFromPublicUrl(u);
    if (!abs) continue;
    total += safeStatSize(abs);
  }
  return total;
}

function examBlobFilenameFromUrl(url) {
  const m = String(url || '').match(/\/api\/uploads\/exams\/([^/?#]+)$/i);
  return m ? m[1] : null;
}

async function byteSizeForExamUploadUrl(url) {
  const abs = tryAbsFromPublicUrl(url);
  if (abs && String(abs).includes(`${path.sep}exams${path.sep}`)) {
    const disk = safeStatSize(abs);
    if (disk > 0) return disk;
  }
  const fn = examBlobFilenameFromUrl(url);
  if (!fn) return 0;
  const { rows } = await db.query('SELECT byte_size FROM exam_material_blobs WHERE filename = $1', [fn]);
  return Number(rows[0]?.byte_size) || 0;
}

async function sumExamMaterialUrlsBytes(urls) {
  let total = 0;
  for (const u of urls || []) {
    total += await byteSizeForExamUploadUrl(u);
  }
  return total;
}

/**
 * Recompute storage_used_mb from DB URLs (exams + assignments).
 * Uses best-effort filesystem stat; missing files count as 0.
 */
async function recomputeInstructorStorageUsageMb(instructorId, opts = {}) {
  const { persist = true } = opts;
  if (!instructorId) return { storage_used_mb: 0, storage_used_bytes: 0 };

  // Exams (pdf_url + exam_files jsonb)
  const { rows: examRows } = await db.query(
    `SELECT pdf_url, exam_files
     FROM exams
     WHERE instructor_id = $1`,
    [instructorId],
  );

  const examUrls = [];
  for (const r of examRows) {
    if (r.pdf_url) examUrls.push(r.pdf_url);
    const files = r.exam_files;
    if (Array.isArray(files)) {
      for (const f of files) {
        if (typeof f === 'string') examUrls.push(f);
        else if (f && typeof f === 'object' && f.url) examUrls.push(f.url);
      }
    }
  }

  // Assignments (question_file_url)
  const { rows: assRows } = await db.query(
    `SELECT question_file_url
     FROM assignments
     WHERE instructor_id = $1`,
    [instructorId],
  );
  const assignmentUrls = assRows.map((r) => r.question_file_url).filter(Boolean);

  const examBytes = await sumExamMaterialUrlsBytes(examUrls);
  const assignmentBytes = sumUrlsBytes(assignmentUrls);
  const totalBytes = examBytes + assignmentBytes;
  const storage_used_mb = bytesToMbInt(totalBytes);

  if (persist) {
    await db.query(
      `UPDATE instructor_profiles
       SET storage_used_mb = $2,
           storage_used_bytes = $3,
           usage_synced_at = NOW()
       WHERE user_id = $1`,
      [instructorId, storage_used_mb, totalBytes],
    );

    // Source-of-truth for entitlements
    await db
      .query(
        `UPDATE usage_counters
         SET storage_used_mb = $2,
             storage_used_bytes = $3
         WHERE user_id = $1`,
        [instructorId, storage_used_mb, totalBytes]
      )
      .catch(() => {});
  }

  return { storage_used_mb, storage_used_bytes: totalBytes };
}

async function recomputeInstructorRamUsedMb(instructorId, opts = {}) {
  const { persist = true } = opts;
  if (!instructorId) return { ram_used_mb: 0 };

  // Simulated model:
  // - base: 80MB
  // - +10MB per currently running exam (now between start_time and end_time)
  // - +5MB per active student session (exam_results started within last 30 minutes and not submitted)
  const { rows } = await db.query(
    `SELECT
        COALESCE(ip.ram_limit_mb, 512) AS ram_limit_mb,
        (
          SELECT COUNT(*)::int
          FROM exams e
          WHERE e.instructor_id = ip.user_id
            AND e.start_time IS NOT NULL
            AND NOW() >= e.start_time
            AND NOW() < (e.start_time + (e.duration_minutes || ' minutes')::interval)
        ) AS open_exams,
        (
          SELECT COUNT(DISTINCT er.student_id)::int
          FROM exam_results er
          JOIN exams e2 ON e2.id = er.exam_id
          WHERE e2.instructor_id = ip.user_id
            AND er.started_at IS NOT NULL
            AND er.submitted_at IS NULL
            AND er.started_at > (NOW() - interval '30 minutes')
        ) AS active_sessions
     FROM instructor_profiles ip
     WHERE ip.user_id = $1`,
    [instructorId],
  );

  const r = rows[0];
  if (!r) return { ram_used_mb: 0 };
  const base = 80;
  const openExams = Number(r.open_exams) || 0;
  const activeSessions = Number(r.active_sessions) || 0;
  const limit = Number(r.ram_limit_mb) || 512;

  const raw = base + openExams * 10 + activeSessions * 5;
  const ram_used_mb = clampInt(raw, 0, Math.max(0, limit));

  if (persist) {
    await db.query(
      `UPDATE instructor_profiles
       SET ram_used_mb = $2,
           usage_synced_at = NOW()
       WHERE user_id = $1`,
      [instructorId, ram_used_mb],
    );
  }

  return { ram_used_mb };
}

async function recomputeInstructorUsage(instructorId, opts = {}) {
  const storage = await recomputeInstructorStorageUsageMb(instructorId, opts);
  const ram = await recomputeInstructorRamUsedMb(instructorId, opts);
  return { ...storage, ...ram };
}

function sumDirectoryBytes(dirPath) {
  let total = 0;
  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const ent of entries) {
    const abs = path.join(dirPath, ent.name);
    if (ent.isDirectory()) total += sumDirectoryBytes(abs);
    else if (ent.isFile()) total += safeStatSize(abs);
  }
  return total;
}

async function statfsForPath(targetPath) {
  if (!targetPath) return null;
  try {
    const st = await statfs(targetPath);
    const total_bytes = Number(st.blocks) * Number(st.bsize);
    const free_bytes = Number(st.bfree) * Number(st.bsize);
    const used_bytes = Math.max(0, total_bytes - free_bytes);
    if (!Number.isFinite(total_bytes) || total_bytes <= 0) return null;
    return {
      path: targetPath,
      total_bytes,
      free_bytes,
      used_bytes,
      total_mb: bytesToMbInt(total_bytes),
      free_mb: bytesToMbInt(free_bytes),
      used_mb: bytesToMbInt(used_bytes),
    };
  } catch {
    return null;
  }
}

/** Railway/hosting disk + uploads fayllarının ölçüsü */
async function getPlatformHostingStorageStats() {
  const uploadsRoot =
    process.env.UPLOADS_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, '../../uploads');
  const candidatePaths = [
    uploadsRoot,
    process.env.RAILWAY_VOLUME_MOUNT_PATH,
    '/data',
    '/app/uploads',
    path.join(__dirname, '../../uploads'),
    '/',
  ].filter(Boolean);
  const seen = new Set();
  const mounts = [];
  for (const p of candidatePaths) {
    const norm = path.resolve(p);
    if (seen.has(norm)) continue;
    seen.add(norm);
    const disk = await statfsForPath(norm);
    if (disk) mounts.push(disk);
  }
  mounts.sort((a, b) => b.total_bytes - a.total_bytes);
  const primary = mounts[0] || null;
  const file_used_bytes = sumDirectoryBytes(uploadsRoot);
  const envTotalMb = Number(process.env.PLATFORM_STORAGE_TOTAL_MB);
  const env_total_mb = Number.isFinite(envTotalMb) && envTotalMb > 0 ? Math.round(envTotalMb) : 0;

  const onRailway = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID);
  const onVercel = Boolean(process.env.VERCEL);

  return {
    uploads_root: uploadsRoot,
    storage_used_bytes: file_used_bytes,
    storage_used_mb: bytesToMbInt(file_used_bytes),
    disk: primary,
    disk_mounts: mounts,
    env_total_mb,
    hosting: {
      railway: onRailway,
      vercel: onVercel,
      /** Fayllar Railway backend-də saxlanır; Vercel yalnız frontend */
      note: onVercel && !onRailway
        ? 'Vercel yalnız frontend; yaddaş Railway uploads diskində'
        : null,
    },
  };
}

/** @deprecated use getPlatformHostingStorageStats */
function getPlatformUploadsStorageStats() {
  const uploadsRoot = path.join(__dirname, '../../uploads');
  const storage_used_bytes = sumDirectoryBytes(uploadsRoot);
  return {
    storage_used_bytes,
    storage_used_mb: bytesToMbInt(storage_used_bytes),
    uploads_root: uploadsRoot,
  };
}

async function recomputeAllInstructorsUsage(opts = {}) {
  const { rows } = await db.query('SELECT user_id FROM instructor_profiles');
  const out = { updated: 0 };
  for (const r of rows) {
    await recomputeInstructorUsage(r.user_id, opts);
    out.updated += 1;
  }
  return out;
}

module.exports = {
  bytesToMbInt,
  recomputeInstructorStorageUsageMb,
  recomputeInstructorRamUsedMb,
  recomputeInstructorUsage,
  recomputeAllInstructorsUsage,
  getPlatformUploadsStorageStats,
  getPlatformHostingStorageStats,
};

