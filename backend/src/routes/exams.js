const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const router = require('express').Router();
const {
  createExam,
  listExams,
  instructorStudentExamProgress,
  studentExams,
  getExamQuestions,
  submitExam,
  getResults,
} = require('../controllers/examController');
const { authenticate, authorize } = require('../middleware/auth');
const db = require('../utils/db');
const { normalizeExamStartTime } = require('../utils/examTime');
const { syncExamReminderJob } = require('../services/examService');

const uploadsExamsDir = path.join(__dirname, '../../uploads/exams');
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsExamsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.bin';
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});
const uploadExamFile = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'].includes(file.mimetype);
    if (!ok) return cb(new Error('Yalnız PDF, JPG və ya PNG faylı qəbul edilir'));
    cb(null, true);
  },
});

router.post(
  '/upload',
  authenticate,
  authorize('instructor', 'admin'),
  (req, res, next) => {
    uploadExamFile.single('file')(req, res, (err) => {
      if (err) return res.status(400).json({ success: false, message: err.message || 'Fayl qəbul edilmədi' });
      next();
    });
  },
  (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'Fayl tələb olunur' });
    const rel = `/api/uploads/exams/${req.file.filename}`;
    res.json({ success: true, url: rel, filename: req.file.originalname });
  }
);

router.post('/', authenticate, authorize('instructor', 'admin'), createExam);
router.get('/', authenticate, authorize('instructor', 'admin'), listExams);
router.get('/student-progress', authenticate, authorize('instructor', '