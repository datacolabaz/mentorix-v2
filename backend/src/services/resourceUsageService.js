const fs = require('fs');
const path = require('path');
const db = require('../utils/db');

function bytesToMbInt(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return 0;
  return Math.max(0, Math.round(bytes / (1024 * 1024)));
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

/**
 * Recompute storage_used_mb from DB URLs (exams + assignments).
 * Uses best-effort filesystem stat; missing files count as 0.
 */
async function recomputeInstructorStorageUsageMb(instructorId, opts = {}) {
  const { persist = true } = opts;
  if (!instructorId) return { storage_used_mb: 0 };

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

  const totalBytes = sumUrlsBytes(examUrls) + sumUrlsBytes(assignmentUrls);
  const storage_used_mb = bytesToMbInt(totalBytes);

  if (persist) {
    await db.query(
      `UPDATE instructor_profiles
       SET storage_used_mb = $2,
           usage_synced_at = NOW()
       WHERE user_id = $1`,
      [instructorId, storage_used_mb],
    );
  }

  return { storage_used_mb };
}

async function recomputeAllInstructorsUsage(opts = {}) {
  const { rows } = await db.query('SELECT user_id FROM instructor_profiles');
  const out = { updated: 0 };
  for (const r of rows) {
    await recomputeInstructorStorageUsageMb(r.user_id, opts);
    out.updated += 1;
  }
  return out;
}

module.exports = {
  bytesToMbInt,
  recomputeInstructorStorageUsageMb,
  recomputeAllInstructorsUsage,
};

