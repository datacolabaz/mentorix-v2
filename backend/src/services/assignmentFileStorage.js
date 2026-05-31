const fs = require('fs');
const path = require('path');
const db = require('../utils/db');

function getUploadsRoot() {
  const env = process.env.UPLOADS_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH;
  if (env && String(env).trim()) return path.resolve(String(env).trim());
  return path.join(__dirname, '../../uploads');
}

function getAssignmentsUploadDir() {
  return path.join(getUploadsRoot(), 'assignments');
}

function ensureAssignmentsUploadDir() {
  const dir = getAssignmentsUploadDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function isSafeAssignmentFilename(name) {
  return /^[a-f0-9-]{36}\.(pdf|png|jpe?g|docx?|xlsx?|pptx?|zip|csv)$/i.test(String(name || ''));
}

function contentTypeForFilename(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.doc') return 'application/msword';
  if (ext === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (ext === '.zip') return 'application/zip';
  return 'application/octet-stream';
}

async function persistAssignmentFileBlob(file) {
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
    `INSERT INTO assignment_file_blobs (filename, content_type, data, byte_size)
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

async function readAssignmentFileBuffer(filename) {
  const safe = path.basename(String(filename || ''));
  if (!isSafeAssignmentFilename(safe)) return null;

  const dir = getAssignmentsUploadDir();
  const abs = path.join(dir, safe);
  if (abs.startsWith(dir) && fs.existsSync(abs)) {
    return fs.readFileSync(abs);
  }

  const { rows } = await db.query(
    'SELECT data, content_type FROM assignment_file_blobs WHERE filename = $1',
    [safe],
  );
  if (!rows[0]?.data) return null;
  return {
    buffer: Buffer.isBuffer(rows[0].data) ? rows[0].data : Buffer.from(rows[0].data),
    content_type: rows[0].content_type || contentTypeForFilename(safe),
  };
}

async function sendAssignmentFileToResponse(res, filename) {
  const safe = path.basename(String(filename || ''));
  if (!isSafeAssignmentFilename(safe)) {
    return res.status(400).json({ success: false, message: 'Yanlış fayl adı' });
  }

  const hit = await readAssignmentFileBuffer(safe);
  if (!hit) {
    return res.status(404).json({
      success: false,
      message:
        'Fayl tapılmadı. Fayl köhnə deploy-dan qalıb ola bilər — müəllimdən tapşırıq faylını yenidən yükləməsini xahiş edin.',
    });
  }

  const buf = Buffer.isBuffer(hit) ? hit : hit.buffer;
  const ct = Buffer.isBuffer(hit) ? contentTypeForFilename(safe) : hit.content_type;

  res.setHeader('Content-Type', ct);
  res.setHeader('Content-Disposition', `inline; filename="${safe}"`);
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.setHeader('Referrer-Policy', 'no-referrer');
  return res.send(buf);
}

module.exports = {
  getUploadsRoot,
  getAssignmentsUploadDir,
  ensureAssignmentsUploadDir,
  isSafeAssignmentFilename,
  persistAssignmentFileBlob,
  readAssignmentFileBuffer,
  sendAssignmentFileToResponse,
};
