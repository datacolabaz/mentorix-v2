const router = require('express').Router();
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { verify } = require('../utils/jwt');
const { authenticate, authorize } = require('../middleware/auth');
const { enforceActiveSubscription } = require('../middleware/entitlements');
const {
  ensurePresentationsUploadDir,
  persistPresentationBlob,
  resolveUploadedFileBytes,
} = require('../services/presentationStorage');
const { MATERIALS_MAX_SINGLE_FILE_BYTES } = require('../constants/materialsPlanLimits');
const {
  list,
  getOne,
  create,
  patch,
  remove,
  putAnnotations,
  serveFile,
} = require('../controllers/presentationsController');

function authenticatePresentationFile(req, res, next) {
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

function presentationFileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const mime = String(file.mimetype || '').toLowerCase();
  if (ext === '.pdf' || mime === 'application/pdf') return cb(null, true);
  return cb(new Error('Yalnız PDF faylı yükləyə bilərsiniz.'));
}

const uploadsDir = ensurePresentationsUploadDir();
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, _file, cb) => cb(null, `${crypto.randomUUID()}.pdf`),
});

const uploadPresentationFile = multer({
  storage,
  limits: { fileSize: MATERIALS_MAX_SINGLE_FILE_BYTES },
  fileFilter: presentationFileFilter,
});

router.get('/', authenticate, authorize('instructor'), list);
router.get('/file/:filename', authenticatePresentationFile, serveFile);
router.get('/:id', authenticate, authorize('instructor'), getOne);
router.post(
  '/',
  authenticate,
  authorize('instructor'),
  enforceActiveSubscription,
  (req, res, next) => {
    uploadPresentationFile.single('file')(req, res, (err) => {
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
          await persistPresentationBlob(req.file);
        } catch (blobErr) {
          console.error('[presentations] blob persist failed:', blobErr?.message || blobErr);
        }
      }
      next();
    } catch (e) {
      next(e);
    }
  },
  create,
);
router.patch('/:id', authenticate, authorize('instructor'), enforceActiveSubscription, patch);
router.delete('/:id', authenticate, authorize('instructor'), enforceActiveSubscription, remove);
router.put('/:id/annotations', authenticate, authorize('instructor'), putAnnotations);

module.exports = router;
