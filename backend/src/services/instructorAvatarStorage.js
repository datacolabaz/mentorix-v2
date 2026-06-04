const path = require('path');
const fs = require('fs');
const db = require('../utils/db');

const uploadsDir = path.join(__dirname, '../../uploads/instructor-avatars');
fs.mkdirSync(uploadsDir, { recursive: true });

const FILENAME_RE = /^instructor-[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/i;

function isSafeAvatarFilename(filename) {
  return FILENAME_RE.test(String(filename || '').trim());
}

function diskPath(filename) {
  return path.join(uploadsDir, filename);
}

async function persistAvatarBlob(filename, buffer, contentType) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  await db.query(
    `INSERT INTO instructor_avatar_blobs (filename, content_type, data, byte_size)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (filename) DO UPDATE SET
       content_type = EXCLUDED.content_type,
       data = EXCLUDED.data,
       byte_size = EXCLUDED.byte_size,
       created_at = NOW()`,
    [filename, contentType || 'image/jpeg', buf, buf.length],
  );
}

async function deleteAvatarBlob(filename) {
  if (!isSafeAvatarFilename(filename)) return;
  await db.query('DELETE FROM instructor_avatar_blobs WHERE filename = $1', [filename]).catch(() => {});
}

async function servePublicInstructorAvatar(req, res) {
  const filename = String(req.params.filename || '').trim();
  if (!isSafeAvatarFilename(filename)) {
    return res.status(400).json({ success: false, message: 'Etibarsız fayl adı' });
  }

  const ext = path.extname(filename).toLowerCase();
  const ctByExt =
    ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

  const abs = diskPath(filename);
  try {
    if (fs.existsSync(abs)) {
      try {
        const buf = fs.readFileSync(abs);
        void persistAvatarBlob(filename, buf, ctByExt);
      } catch {
        /* disk oxunuşu uğursuz olsa da faylı göndər */
      }
      res.setHeader('Content-Type', ctByExt);
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
      res.setHeader('Referrer-Policy', 'no-referrer');
      return res.sendFile(abs);
    }
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }

  const { rows } = await db.query(
    'SELECT data, content_type FROM instructor_avatar_blobs WHERE filename = $1',
    [filename],
  );
  const row = rows[0];
  if (row?.data) {
    const ct = row.content_type || ctByExt;
    res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const buf = Buffer.isBuffer(row.data) ? row.data : Buffer.from(row.data);
    return res.send(buf);
  }

  return res.status(404).end();
}

module.exports = {
  uploadsDir,
  isSafeAvatarFilename,
  persistAvatarBlob,
  deleteAvatarBlob,
  servePublicInstructorAvatar,
};
