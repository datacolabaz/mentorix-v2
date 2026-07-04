const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const db = require('../utils/db');
const router = require('express').Router();
const { verify } = require('../utils/jwt');
const {
  createExam,
  listExams,
  softDeleteExam,
  hardDeleteExam,
  bulkHardDeleteExams,
  getExamAssignments,
  grantLateAccess,
  patchExam,
  bulkPatchOpenModelAnswers,
  instructorStudentExamProgress,
  studentExams,
  getExamAccessStatus,
  postExamAccessRequest,
  postExamAccessFromLink,
  getStudentExamReview,
  getExamQuestions,
  submitExam,
  confirmOpenQuestionGrading,
  getResults,
  getExamGroups,
  getExamTop10,
  regradeExamResults,
  serveExamMaterialFile,
  serveExamAttachmentByExam,
} = require('../controllers/examController');
const { authenticate, authorize } = require('../middleware/auth');
const { requireInstructorPhoneVerification } = require('../middleware/requireInstructorPhoneVerification');
const { enforceStorageLimitAfterUpload } = require('../middleware/storageLimit');
const { enforceActiveSubscription, enforceExamsLimit } = require('../middleware/entitlements');

const uploadsExamsDir = path.join(__dirname, '../../uploads/exams');
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsExamsDir),
  filename: (req, file, cb) => {
    let ext = path.extname(file.originalname || '').toLowerCase();
    if (!ext || ext === '.bin') {
      const mt = String(file.mimetype || '').toLowerCase();
      if (mt === 'image/png') ext = '.png';
      else if (mt === 'image/jpeg' || mt === 'image/jpg') ext = '.jpg';
      else if (mt === 'application/pdf') ext = '.pdf';
      else ext = '.bin';
    }
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});
const uploadExamFile = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'].includes(file.mimetype);
    if (!ok) return cb(new Error('Yalniz PDF, JPG ve ya PNG fayli qebul edilir'));
    cb(null, true);
  },
});

router.post(
  '/upload',
  authenticate,
  authorize('instructor', 'admin'),
  enforceActiveSubscription,
  (req, res, next) => {
    uploadExamFile.single('file')(req, res, (err) => {
      if (err) return res.status(400).json({ success: false, message: err.message || 'Fayl qebul edilmedi' });
      next();
    });
  },
  enforceStorageLimitAfterUpload,
  async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'Fayl teleb olunur' });
    try {
      const buf = fs.readFileSync(req.file.path);
      const ct = req.file.mimetype || 'application/octet-stream';
      await db.query(
        `INSERT INTO exam_material_blobs (filename, content_type, data, byte_size)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (filename) DO UPDATE SET
           content_type = EXCLUDED.content_type,
           data = EXCLUDED.data,
           byte_size = EXCLUDED.byte_size,
           created_at = NOW()`,
        [req.file.filename, ct, buf, buf.length]
      );
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkErr) {
        console.error('exam upload tmp unlink', unlinkErr.message);
      }
    } catch (e) {
      console.error('exam material blob persist', e);
      try {
        fs.unlinkSync(req.file.path);
      } catch (_) {
        /* ignore */
      }
      return res.status(500).json({ success: false, message: 'Fayl saxlanılmadı' });
    }
    const rel = `/api/uploads/exams/${req.file.filename}`;
    res.json({ success: true, url: rel, filename: req.file.originalname });
  }
);

/** Bearer və ya ?token= (yeni pəncərə); /api/uploads proxysiz deploy üçün */
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

router.get('/material-file/:filename', authenticateMaterialFile, serveExamMaterialFile);
router.get(
  '/by-exam/:examId/attachment/:filename',
  authenticateMaterialFile,
  serveExamAttachmentByExam
);

router.post(
  '/',
  authenticate,
  authorize('instructor', 'admin'),
  requireInstructorPhoneVerification({ trigger: 'exam' }),
  enforceActiveSubscription,
  enforceExamsLimit,
  createExam,
);
router.get('/', authenticate, authorize('instructor', 'admin'), listExams);
router.get('/student-progress', authenticate, authorize('instructor', 'admin'), instructorStudentExamProgress);
router.get('/my', authenticate, authorize('student'), studentExams);
router.get('/:id/access-status', authenticate, authorize('student'), getExamAccessStatus);
router.post('/:id/access-request', authenticate, authorize('student'), postExamAccessRequest);
router.post('/:id/access-from-link', authenticate, authorize('student'), postExamAccessFromLink);
router.post(
  '/bulk-delete',
  authenticate,
  authorize('instructor', 'admin'),
  enforceActiveSubscription,
  bulkHardDeleteExams,
);
router.get('/:id/assignments', authenticate, authorize('instructor', 'admin'), getExamAssignments);
router.post('/:id/late-access/:studentId', authenticate, authorize('instructor', 'admin'), grantLateAccess);
router.get('/:id/review', authenticate, getStudentExamReview);
router.patch(
  '/:id/results/:resultId/open-grading/:questionId',
  authenticate,
  authorize('instructor', 'admin'),
  confirmOpenQuestionGrading,
);
router.get('/:id/questions', authenticate, getExamQuestions);
router.post('/submit', authenticate, authorize('student'), submitExam);
router.get('/:id/results', authenticate, getResults);
router.get('/:id/groups', authenticate, authorize('instructor', 'admin'), getExamGroups);
router.get('/:id/top10', authenticate, authorize('instructor', 'admin'), getExamTop10);
router.post(
  '/:id/regrade',
  authenticate,
  authorize('instructor', 'admin'),
  enforceActiveSubscription,
  regradeExamResults,
);
// DELETE default: hard delete (full cleanup). Soft delete is available separately.
router.delete(
  '/:id',
  authenticate,
  authorize('instructor', 'admin'),
  enforceActiveSubscription,
  hardDeleteExam,
);
router.delete(
  '/:id/soft',
  authenticate,
  authorize('instructor', 'admin'),
  enforceActiveSubscription,
  softDeleteExam,
);

router.patch(
  '/:id/open-model-answers',
  authenticate,
  authorize('instructor', 'admin'),
  enforceActiveSubscription,
  bulkPatchOpenModelAnswers,
);
router.patch(
  '/:id',
  authenticate,
  authorize('instructor', 'admin'),
  enforceActiveSubscription,
  patchExam,
);

module.exports = router;
 







































