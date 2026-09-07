const fs = require('fs');
const path = require('path');
const db = require('../utils/db');

function getUploadsRoot() {
  const env = process.env.UPLOADS_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH;
  if (env && String(env).trim()) return path.resolve(String(env).trim());
  return path.join(__dirname, '../../uploads');
}

function getPresentationsUploadDir() {
  return path.join(getUploadsRoot(), 'presentations');
}

function ensurePresentationsUploadDir() {
  const dir = getPresentationsUploadDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function isSafePresentationFilename(name) {
  return /^[a-f0-9-]{36}\.pdf$/i.test(String(name || ''));
}

function resolveUploadedFileBytes(file) {
  const cached = Number(file?.byteSize ?? file?.size);
  if (Number.isFinite(cached) && cached > 0) return Math.round(cached);
  if (file?.path && fs.existsSync(file.path)) {
    try {
      const statSize = fs.statSync(file.path).size;
      if (statSize > 0) return statSize;
    } catch {
      /* fall through */
    }
  }
  if (file?.buffer && Buffer.isBuffer(file.buffer) && file.buffer.length > 0) {
    return file.buffer.length;
  }
  return 0;
}

async function resolveUploadedFileBytesAsync(file) {
  const direct = resolveUploadedFileBytes(file);
  if (direct > 0) return direct;

  const filename = path.basename(String(file?.filename || ''));
  if (!isSafePresentationFilename(filename)) return 0;

  try {
    const { rows } = await db.query(
      'SELECT byte_size FROM presentation_blobs WHERE filename = $1 LIMIT 1',
      [filename],
    );
    const dbSize = Number(rows[0]?.byte_size);
    if (Number.isFinite(dbSize) && dbSize > 0) {
      file.byteSize = dbSize;
      file.size = dbSize;
      return Math.round(dbSize);
    }
  } catch {
    /* blob table may be unavailable */
  }
  return 0;
}

async function persistPresentationBlob(file) {
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
  file.size = buf.length;
  file.byteSize = buf.length;
  await db.query(
    `INSERT INTO presentation_blobs (filename, content_type, data, byte_size)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (filename) DO UPDATE SET
       content_type = EXCLUDED.content_type,
       data = EXCLUDED.data,
       byte_size = EXCLUDED.byte_size,
       created_at = NOW()`,
    [filename, 'application/pdf', buf, buf.length],
  );
  try {
    if (file.path) fs.unlinkSync(file.path);
  } catch {
    /* ignore */
  }
}

async function readPresentationBuffer(filename) {
  const safe = path.basename(String(filename || ''));
  if (!isSafePresentationFilename(safe)) return null;

  const dir = getPresentationsUploadDir();
  const abs = path.join(dir, safe);
  if (abs.startsWith(dir) && fs.existsSync(abs)) {
    return { buffer: fs.readFileSync(abs), content_type: 'application/pdf' };
  }

  const { rows } = await db.query(
    'SELECT data, content_type FROM presentation_blobs WHERE filename = $1',
    [safe],
  );
  if (!rows[0]?.data) return null;
  return {
    buffer: Buffer.isBuffer(rows[0].data) ? rows[0].data : Buffer.from(rows[0].data),
    content_type: rows[0].content_type || 'application/pdf',
  };
}

async function deletePresentationBlob(filename) {
  const safe = path.basename(String(filename || ''));
  if (!isSafePresentationFilename(safe)) return;
  const dir = getPresentationsUploadDir();
  const abs = path.join(dir, safe);
  try {
    if (abs.startsWith(dir) && fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch {
    /* ignore */
  }
  await db.query('DELETE FROM presentation_blobs WHERE filename = $1', [safe]).catch(() => {});
}

module.exports = {
  getPresentationsUploadDir,
  ensurePresentationsUploadDir,
  isSafePresentationFilename,
  resolveUploadedFileBytes,
  resolveUploadedFileBytesAsync,
  persistPresentationBlob,
  readPresentationBuffer,
  deletePresentationBlob,
};
