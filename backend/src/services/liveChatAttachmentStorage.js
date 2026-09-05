const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../utils/db');

const LIVE_CHAT_UPLOAD_DIR = path.join(__dirname, '../../uploads/live-chat');
fs.mkdirSync(LIVE_CHAT_UPLOAD_DIR, { recursive: true });

const MAX_BYTES = 5 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, LIVE_CHAT_UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(String(file.originalname || '')).slice(0, 16);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`);
  },
});

function liveChatFileFilter(_req, file, cb) {
  const mime = String(file.mimetype || '').toLowerCase();
  const blocked = new Set(['image/svg+xml', 'text/html', 'application/javascript']);
  if (blocked.has(mime)) {
    const err = new Error('Bu fayl tipi qəbul olunmur');
    err.statusCode = 400;
    return cb(err);
  }
  const ok =
    mime === 'image/jpeg' || mime === 'image/png' || mime === 'image/webp' || mime === 'application/pdf';
  if (!ok) {
    const err = new Error('Yalnız JPEG, PNG, WebP və PDF faylları qəbul olunur (maks. 5 MB)');
    err.statusCode = 400;
    return cb(err);
  }
  cb(null, true);
}

const uploadLiveChatAttachment = multer({
  storage,
  limits: { fileSize: MAX_BYTES },
  fileFilter: liveChatFileFilter,
});

function publicLiveChatAttachmentPath(filename) {
  return `/api/live/chat-attachments/${filename}`;
}

function isAllowedLiveChatAttachmentUrl(url) {
  return /^\/api\/live\/chat-attachments\/[A-Za-z0-9._-]+$/.test(String(url || '').trim());
}

async function insertLiveChatAttachment({
  roomId,
  file,
  userId = null,
  guestParticipantId = null,
}) {
  const filename = file.filename;
  const original = String(file.originalname || 'file').slice(0, 255);
  const { rows } = await db.query(
    `INSERT INTO live_chat_attachments
       (room_id, filename, original_name, content_type, byte_size, uploaded_by_user_id, guest_participant_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      roomId,
      filename,
      original,
      String(file.mimetype || 'application/octet-stream').slice(0, 80),
      Number(file.size) || 0,
      userId,
      guestParticipantId,
    ],
  );
  const row = rows[0];
  return {
    url: publicLiveChatAttachmentPath(row.filename),
    name: row.original_name,
    type: row.content_type,
    size: row.byte_size,
  };
}

async function getLiveChatAttachmentByFilename(filename) {
  const name = String(filename || '').trim();
  if (!name || name.includes('/') || name.includes('..')) return null;
  const { rows } = await db.query(
    `SELECT a.*, lr.room_code, lr.instructor_id
     FROM live_chat_attachments a
     JOIN live_rooms lr ON lr.id = a.room_id
     WHERE a.filename = $1
     LIMIT 1`,
    [name],
  );
  return rows[0] || null;
}

function sendLiveChatFile(res, row) {
  const filePath = path.join(LIVE_CHAT_UPLOAD_DIR, row.filename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ success: false, message: 'Fayl tapılmadı' });
    return;
  }
  res.setHeader('Content-Type', row.content_type || 'application/octet-stream');
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${encodeURIComponent(row.original_name || row.filename)}"`,
  );
  fs.createReadStream(filePath).pipe(res);
}

async function deleteLiveChatFilesForRoom(roomId) {
  const { rows } = await db.query(`SELECT filename FROM live_chat_attachments WHERE room_id = $1`, [roomId]);
  for (const row of rows) {
    const filePath = path.join(LIVE_CHAT_UPLOAD_DIR, row.filename);
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {
      /* ignore */
    }
  }
}

module.exports = {
  MAX_BYTES,
  uploadLiveChatAttachment,
  publicLiveChatAttachmentPath,
  isAllowedLiveChatAttachmentUrl,
  insertLiveChatAttachment,
  getLiveChatAttachmentByFilename,
  sendLiveChatFile,
  deleteLiveChatFilesForRoom,
};
