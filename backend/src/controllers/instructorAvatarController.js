const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../utils/db');
const {
  uploadsDir,
  isSafeAvatarFilename,
  persistAvatarBlob,
  deleteAvatarBlob,
  servePublicInstructorAvatar,
} = require('../services/instructorAvatarStorage');

fs.mkdirSync(uploadsDir, { recursive: true });

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

const extForMime = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const uploadAvatar = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
      const ext = extForMime[file.mimetype] || path.extname(file.originalname || '').toLowerCase() || '.jpg';
      cb(null, `instructor-${req.user.id}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype || !ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error('Yalnız JPEG, PNG və ya WebP qəbul olunur'));
    }
    cb(null, true);
  },
}).single('avatar');

function avatarRelPath(filename) {
  return `/api/uploads/instructor-avatars/${filename}`;
}

function filenameFromAvatarUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const marker = '/instructor-avatars/';
  const idx = url.indexOf(marker);
  if (idx < 0) return null;
  const filename = url.slice(idx + marker.length).split('?')[0];
  return isSafeAvatarFilename(filename) ? filename : null;
}

function tryUnlinkAvatarUrl(url) {
  const filename = filenameFromAvatarUrl(url);
  if (!filename) return;
  const full = path.join(uploadsDir, filename);
  fs.unlink(full, () => {});
  void deleteAvatarBlob(filename);
}

const postInstructorAvatar = (req, res) => {
  uploadAvatar(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message || 'Yükləmə xətası' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Şəkil faylı seçin' });
    }
    try {
      const rel = avatarRelPath(req.file.filename);
      const buf = fs.readFileSync(req.file.path);
      await persistAvatarBlob(req.file.filename, buf, req.file.mimetype);

      const { rows: prev } = await db.query(
        `SELECT avatar_url FROM instructor_profiles WHERE user_id = $1 LIMIT 1`,
        [req.user.id],
      );
      const oldUrl = prev[0]?.avatar_url;
      const { rowCount } = await db.query(
        `UPDATE instructor_profiles SET avatar_url = $1 WHERE user_id = $2`,
        [rel, req.user.id],
      );
      if (!rowCount) {
        tryUnlinkAvatarUrl(rel);
        return res.status(404).json({ success: false, message: 'Müəllim profili tapılmadı' });
      }
      if (oldUrl && oldUrl !== rel) tryUnlinkAvatarUrl(oldUrl);
      res.json({ success: true, avatar_url: rel });
    } catch (e) {
      tryUnlinkAvatarUrl(avatarRelPath(req.file.filename));
      res.status(e.statusCode || 500).json({ success: false, message: e.message });
    }
  });
};

const deleteInstructorAvatar = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT avatar_url FROM instructor_profiles WHERE user_id = $1 LIMIT 1`,
      [req.user.id],
    );
    const oldUrl = rows[0]?.avatar_url;
    await db.query(`UPDATE instructor_profiles SET avatar_url = NULL WHERE user_id = $1`, [req.user.id]);
    if (oldUrl) tryUnlinkAvatarUrl(oldUrl);
    res.json({ success: true, avatar_url: null });
  } catch (e) {
    res.status(e.statusCode || 500).json({ success: false, message: e.message });
  }
};

module.exports = { postInstructorAvatar, deleteInstructorAvatar, servePublicInstructorAvatar };
