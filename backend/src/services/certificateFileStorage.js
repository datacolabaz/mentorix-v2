const fs = require('fs');
const path = require('path');
const db = require('../utils/db');

function getUploadsRoot() {
  const env = process.env.UPLOADS_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH;
  if (env && String(env).trim()) return path.resolve(String(env).trim());
  return path.join(__dirname, '../../uploads');
}

function ensureCertificatesUploadDir() {
  const dir = path.join(getUploadsRoot(), 'certificates');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function isSafeCertificateFilename(name) {
  return /^[a-f0-9-]{36}\.pdf$/i.test(String(name || ''));
}

async function persistCertificateFileBlob(filename, buffer, contentType = 'application/pdf') {
  const safe = path.basename(String(filename || ''));
  if (!isSafeCertificateFilename(safe) || !buffer?.length) return;
  await db.query(
    `INSERT INTO certificate_file_blobs (filename, content_type, data, byte_size)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (filename) DO UPDATE SET
       content_type = EXCLUDED.content_type,
       data = EXCLUDED.data,
       byte_size = EXCLUDED.byte_size,
       created_at = NOW()`,
    [safe, contentType, buffer, buffer.length],
  );
  try {
    fs.writeFileSync(path.join(ensureCertificatesUploadDir(), safe), buffer);
  } catch {
    /* optional disk */
  }
}

async function readCertificateFileBuffer(filename) {
  const safe = path.basename(String(filename || ''));
  if (!isSafeCertificateFilename(safe)) return null;
  const dir = ensureCertificatesUploadDir();
  const abs = path.join(dir, safe);
  if (abs.startsWith(dir) && fs.existsSync(abs)) {
    return { buffer: fs.readFileSync(abs), contentType: 'application/pdf' };
  }
  const { rows } = await db.query(
    'SELECT data, content_type FROM certificate_file_blobs WHERE filename = $1',
    [safe],
  );
  if (!rows[0]?.data) return null;
  return { buffer: rows[0].data, contentType: rows[0].content_type || 'application/pdf' };
}

module.exports = {
  ensureCertificatesUploadDir,
  isSafeCertificateFilename,
  persistCertificateFileBlob,
  readCertificateFileBuffer,
};
