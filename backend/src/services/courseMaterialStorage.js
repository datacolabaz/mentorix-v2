const fs = require('fs');
const path = require('path');
const db = require('../utils/db');

function getUploadsRoot() {
  const env = process.env.UPLOADS_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH;
  if (env && String(env).trim()) return path.resolve(String(env).trim());
  return path.join(__dirname, '../../uploads');
}

function getCourseMaterialsUploadDir() {
  return path.join(getUploadsRoot(), 'course-materials');
}

function ensureCourseMaterialsUploadDir() {
  const dir = getCourseMaterialsUploadDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function isSafeCourseMaterialFilename(name) {
  return /^[a-f0-9-]{36}\.(pdf|png|jpe?g|gif|webp|docx?|xlsx?|pptx?|csv|txt)$/i.test(String(name || ''));
}

function contentTypeForFilename(filename) {
  const ext = path.extname(filename).toLowerCase();
  const map = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.csv': 'text/csv',
    '.txt': 'text/plain',
  };
  return map[ext] || 'application/octet-stream';
}

async function persistCourseMaterialBlob(file) {
  if (!file?.filename) return;
  const filename = path.basename(String(file.filename));
  let buf;
  if (file.path && fs.existsSync(file.path)) {
    buf = fs.readFileSync(file.path);
  } else if (file.buffer) {
    buf = file.buffer;
  } else {
    return;
  }
  const ct = file.mimetype || contentTypeForFilename(filename);
  await db.query(
    `INSERT INTO course_material_blobs (filename, content_type, data, byte_size)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (filename) DO UPDATE SET
       content_type = EXCLUDED.content_type,
       data = EXCLUDED.data,
       byte_size = EXCLUDED.byte_size,
       created_at = NOW()`,
    [filename, ct, buf, buf.length],
  );
  try {
    if (file.path) fs.unlinkSync(file.path);
  } catch {
    /* ignore */
  }
}

async function readCourseMaterialBuffer(filename) {
  const safe = path.basename(String(filename || ''));
  if (!isSafeCourseMaterialFilename(safe)) return null;

  const dir = getCourseMaterialsUploadDir();
  const abs = path.join(dir, safe);
  if (abs.startsWith(dir) && fs.existsSync(abs)) {
    return { buffer: fs.readFileSync(abs), content_type: contentTypeForFilename(safe) };
  }

  const { rows } = await db.query(
    'SELECT data, content_type FROM course_material_blobs WHERE filename = $1',
    [safe],
  );
  if (!rows[0]?.data) return null;
  return {
    buffer: Buffer.isBuffer(rows[0].data) ? rows[0].data : Buffer.from(rows[0].data),
    content_type: rows[0].content_type || contentTypeForFilename(safe),
  };
}

async function deleteCourseMaterialBlob(filename) {
  const safe = path.basename(String(filename || ''));
  if (!isSafeCourseMaterialFilename(safe)) return;
  const dir = getCourseMaterialsUploadDir();
  const abs = path.join(dir, safe);
  try {
    if (abs.startsWith(dir) && fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch {
    /* ignore */
  }
  await db.query('DELETE FROM course_material_blobs WHERE filename = $1', [safe]).catch(() => {});
}

module.exports = {
  getCourseMaterialsUploadDir,
  ensureCourseMaterialsUploadDir,
  isSafeCourseMaterialFilename,
  contentTypeForFilename,
  persistCourseMaterialBlob,
  readCourseMaterialBuffer,
  deleteCourseMaterialBlob,
};
