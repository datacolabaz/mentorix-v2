const router = require('express').Router();
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { verify } = require('../utils/jwt');
const { authenticate, authorize } = require('../middleware/auth');
const { enforceActiveSubscription } = require('../middleware/entitlements');
const { ensureCourseMaterialsUploadDir, persistCourseMaterialBlob, resolveUploadedFileBytes } = require('../services/courseMaterialStorage');
const { MATERIALS_MAX_SINGLE_FILE_BYTES } = require('../constants/materialsPlanLimits');
const {
  getQuota,
  listMaterials,
  getOptions,
  postMaterial,
  removeMaterial,
  serveMaterialFile,
  listMyMaterials,
  listAssignmentMaterials,
} = require('../controllers/courseMaterialsController');

function authenticateMaterialFile(req, res, next) {
  const headerToken = req.headers.authorization?.split(' ')[1];
  const q = req.query.token;
  const token = headerToken || (typeof q === 'string' && q.trim() ? q.trim() : null);
  if (!token) return res.status(401).json({ success: false, message: 'Token yoxdur' });
  try {
    req.user = verify(token);
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Token etibarsızdır' });
  }
}

const MATERIAL_MIME_OK = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'text/csv',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

function materialFileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const extOk = ['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.csv', '.txt'].includes(ext);
  if (MATERIAL_MIME_OK.has(file.mimetype) || extOk) return cb(null, true);
  return cb(new Error('Fayl formatı dəstəklənmir (PDF, Word, Excel, PowerPoint, şəkil, CSV)'));
}

const uploadsDir = ensureCourseMaterialsUploadDir();
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    let ext = path.extname(file.originalname || '').toLowerCase();
    if (!ext || ext === '.bin') {
      const mt = String(file.mimetype || '').toLowerCase();
      const map = {
        'image/png': '.png',
        'image/jpeg': '.jpg',
        'image/gif': '.gif',
        'image/webp': '.webp',
        'application/pdf': '.pdf',
        'text/csv': '.csv',
        'text/plain': '.txt',
        'application/vnd.ms-excel': '.xls',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
        'application/msword': '.doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
        'application/vnd.ms-powerpoint': '.ppt',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
      };
      ext = map[mt] || '.bin';
    }
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const uploadMaterialFile = multer({
  storage,
  limits: { fileSize: MATERIALS_MAX_SINGLE_FILE_BYTES },
  fileFilter: materialFileFilter,
});

router.get('/quota', authenticate, authorize('instructor'), getQuota);
router.get('/options', authenticate, authorize('instructor'), getOptions);
router.get('/', authenticate, authorize('instructor'), listMaterials);
router.post(
  '/',
  authenticate,
  authorize('instructor'),
  enforceActiveSubscription,
  (req, res, next) => {
    uploadMaterialFile.single('file')(req, res, (err) => {
      if (err) {
        const msg =
          err.code === 'LIMIT_FILE_SIZE'
            ? 'Tək fayl ölçüsü 25 MB-dan çox ola bilməz.'
            : err.message || 'Fayl qəbul edilmədi';
        return res.status(400).json({ success: false, message: msg });
      }
      next();
    });
  },
  async (req, res, next) => {
    try {
      if (req.file?.path && require('fs').existsSync(req.file.path)) {
        const diskSize = resolveUploadedFileBytes(req.file);
        if (diskSize > 0) {
          req.file.byteSize = diskSize;
          req.file.size = diskSize;
        }
      }
      if (req.file) {
        try {
          await persistCourseMaterialBlob(req.file);
        } catch (blobErr) {
          console.error('[materials] blob persist failed:', blobErr?.message || blobErr);
        }
      }
      next();
    } catch (e) {
      next(e);
    }
  },
  postMaterial,
);
router.delete('/:id', authenticate, authorize('instructor'), enforceActiveSubscription, removeMaterial);

router.get('/my', authenticate, authorize('student'), listMyMaterials);
router.get('/assignment/:assignmentId', authenticate, authorize('student'), listAssignmentMaterials);
router.get('/file/:filename', authenticateMaterialFile, serveMaterialFile);

module.exports = router;
