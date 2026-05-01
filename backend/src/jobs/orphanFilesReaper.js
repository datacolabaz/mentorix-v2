const fs = require('fs');
const path = require('path');
const db = require('../utils/db');

function examFilenameFromPublicUrl(url) {
  const m = String(url || '').match(/\/api\/uploads\/exams\/([^/?#]+)$/i);
  return m ? m[1] : null;
}

async function referencedExamFilenames() {
  const { rows } = await db.query(`SELECT pdf_url, exam_files FROM exams`);
  const set = new Set();
  for (const r of rows || []) {
    const fn1 = examFilenameFromPublicUrl(r.pdf_url);
    if (fn1) set.add(fn1);
    const files = r.exam_files;
    if (Array.isArray(files)) {
      for (const f of files) {
        const url = typeof f === 'string' ? f : f && typeof f === 'object' ? f.url : null;
        const fn = examFilenameFromPublicUrl(url);
        if (fn) set.add(fn);
      }
    }
  }
  return set;
}

async function cleanupOrphanExamMaterialBlobs() {
  // Remove DB blobs that are not referenced by any exam row.
  const referenced = await referencedExamFilenames();
  const { rows } = await db.query(`SELECT filename FROM exam_material_blobs`);
  let deleted = 0;
  for (const r of rows || []) {
    const fn = r.filename ? String(r.filename) : '';
    if (!fn) continue;
    if (referenced.has(fn)) continue;
    await db.query(`DELETE FROM exam_material_blobs WHERE filename = $1`, [fn]);
    deleted += 1;
  }
  return { deleted };
}

async function cleanupOrphanExamUploadsOnDisk() {
  // Best-effort disk cleanup for local dev / legacy. Railway may not persist disk anyway.
  const dir = path.join(__dirname, '../../uploads/exams');
  let files = [];
  try {
    files = fs.readdirSync(dir);
  } catch {
    return { deleted: 0 };
  }
  const referenced = await referencedExamFilenames();
  let deleted = 0;
  for (const fn of files) {
    if (!fn || fn.startsWith('.')) continue;
    if (referenced.has(fn)) continue;
    try {
      fs.unlinkSync(path.join(dir, fn));
      deleted += 1;
    } catch {
      // ignore
    }
  }
  return { deleted };
}

async function runOrphanFilesReaper() {
  const a = await cleanupOrphanExamMaterialBlobs().catch(() => ({ deleted: 0 }));
  const b = await cleanupOrphanExamUploadsOnDisk().catch(() => ({ deleted: 0 }));
  return { exam_blobs_deleted: a.deleted, exam_disk_deleted: b.deleted };
}

module.exports = { runOrphanFilesReaper };

