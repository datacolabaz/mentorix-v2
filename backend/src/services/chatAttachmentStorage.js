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
  const ok = mime.startsWith('image/') || mime === 'application/pdf';
  if (!ok) {
    const err = new Error('Yalnız şəkil və PDF faylları qəbul olunur');
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
  return `/api/uploads/chat/${filename}`;
}

module.exports = {
  CHAT_UPLOAD_DIR,
  MAX_BYTES,
  uploadChatAttachment,
  publicChatAttachmentPath,
};
