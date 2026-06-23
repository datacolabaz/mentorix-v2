const path = require('path');
const fs = require('fs');
const multer = require('multer');

const CHAT_UPLOAD_DIR = path.join(__dirname, '../../uploads/chat');
fs.mkdirSync(CHAT_UPLOAD_DIR, { recursive: true });

const MAX_BYTES = 5 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, CHAT_UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(String(file.originalname || '')).slice(0, 16);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`);
  },
});

function chatFileFilter(_req, file, cb) {
  const mime = String(file.mimetype || '').toLowerCase();
  const blocked = new Set(['image/svg+xml', 'text/html', 'application/javascript']);
  if (blocked.has(mime)) {
    const err = new Error('Bu fayl tipi qəbul olunmur');
    err.code = 'CHAT_FILE_TYPE';
    err.statusCode = 400;
    return cb(err);
  }
  const ok = mime === 'image/jpeg' || mime === 'image/png' || mime === 'image/webp' || mime === 'application/pdf';
  if (!ok) {
    const err = new Error('Yalnız JPEG, PNG, WebP və PDF faylları qəbul olunur');
    err.code = 'CHAT_FILE_TYPE';
    err.statusCode = 400;
    return cb(err);
  }
  cb(null, true);
}

const uploadChatAttachment = multer({
  storage,
  limits: { fileSize: MAX_BYTES },
  fileFilter: chatFileFilter,
});

function publicChatAttachmentPath(filename) {
  return `/api/chat/attachments/${filename}`;
}

function isAllowedChatAttachmentUrl(url) {
  if (!url) return true;
  const u = String(url).trim();
  return /^\/api\/chat\/attachments\/[A-Za-z0-9._-]+$/.test(u)
    || /^\/api\/uploads\/chat\/[A-Za-z0-9._-]+$/.test(u);
}

function extractChatAttachmentFilename(url) {
  const u = String(url || '').trim();
  const m = u.match(/\/(?:chat\/attachments|uploads\/chat)\/([^/?#]+)$/);
  return m ? m[1] : null;
}

module.exports = {
  CHAT_UPLOAD_DIR,
  MAX_BYTES,
  uploadChatAttachment,
  publicChatAttachmentPath,
  isAllowedChatAttachmentUrl,
  extractChatAttachmentFilename,
};
