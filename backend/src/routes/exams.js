const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const router = require('express').Router();
const {
  createExam,
  listExams,
  softDeleteExam,
  hardDeleteExam,
  bulkHardDeleteExams,
  getExamAssignments,
  grantLateAccess,
  patchExam,
  instructorStudentExamProgress,
  studentExams,
  getStudentExamReview,
  getExamQuestions,
  submitExam,
  getResults,
  getExamGroups,
  getExamTop10,
  regradeExamResults,
} = require('../controllers/examController');
const { authenticate, authorize } = require('../middleware/auth');
const { enforceStorageLimitAfterUpload } = require('../middleware/storageLimit');

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
  (req, res, next) => {
    uploadExamFile.single('file')(req, res, (err) => {
      if (err) return res.status(400).json({ success: false, message: err.message || 'Fayl qebul edilmedi' });
      next();
    });
  },
  enforceStorageLimitAfterUpload,
  (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'Fayl teleb olunur' });
    const rel = `/api/uploads/exams/${req.file.filename}`;
    res.json({ success: true, url: rel, filename: req.file.originalname });
  }
);

router.post('/', authenticate, authorize('instructor', 'admin'), createExam);
router.get('/', authenticate, authorize('instructor', 'admin'), listExams);
router.get('/student-progress', authenticate, authorize('instructor', 'admin'), instructorStudentExamProgress);
router.get('/my', authenticate, authorize('student'), studentExams);
router.post('/bulk-delete', authenticate, authorize('instructor', 'admin'), bulkHardDeleteExams);
router.get('/:id/assignments', authenticate, authorize('instructor', 'admin'), getExamAssignments);
router.post('/:id/late-access/:studentId', authenticate, authorize('instructor', 'admin'), grantLateAccess);
router.get('/:id/review', authenticate, getStudentExamReview);
router.get('/:id/questions', authenticate, getExamQuestions);
router.post('/submit', authenticate, authorize('student'), submitExam);
router.get('/:id/results', authenticate, getResults);
router.get('/:id/groups', authenticate, authorize('instructor', 'admin'), getExamGroups);
router.get('/:id/top10', authenticate, authorize('instructor', 'admin'), getExamTop10);
router.post('/:id/regrade', authenticate, authorize('instructor', 'admin'), regradeExamResults);
// DELETE default: hard delete (full cleanup). Soft delete is available separately.
router.delete('/:id', authenticate, authorize('instructor', 'admin'), hardDeleteExam);
router.delete('/:id/soft', authenticate, authorize('instructor', 'admin'), softDeleteExam);

router.patch('/:id', authenticate, authorize('instructor', 'admin'), patchExam);

module.exports = router;
 







































