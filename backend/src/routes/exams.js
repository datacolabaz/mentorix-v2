const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const router = require('express').Router();
const {
  createExam,
  listExams,
  softDeleteExam,
  hardDeleteExam,
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
router.get('/student-progress', authenticate, authorize('instructor', 'admin'), instructorStudentExamProgress);
router.get('/my', authenticate, authorize('student'), studentExams);
router.get('/:id/review', authenticate, getStudentExamReview);
router.get('/:id/questions', authenticate, getExamQuestions);
router.post('/submit', authenticate, authorize('student'), submitExam);
router.get('/:id/results', authenticate, getResults);
router.get('/:id/groups', authenticate, authorize('instructor', 'admin'), getExamGroups);
router.get('/:id/top10', authenticate, authorize('instructor', 'admin'), getExamTop10);
router.post('/:id/regrade', authenticate, authorize('instructor', 'admin'), regradeExamResults);
router.delete('/:id', authenticate, authorize('instructor', 'admin'), softDeleteExam);
router.delete('/:id/hard', authenticate, authorize('instructor', 'admin'), hardDeleteExam);
 
// Imtahani edit et
router.patch('/:id', authenticate, authorize('instructor', 'admin'), async (req, res) => {
  try {
    const { title, subject, topic, start_time, duration_minutes, notify_students, show_results } = req.body;
    const startNorm = start_time != null && start_time !== '' ? normalizeExamStartTime(start_time) : null;
    const ns = notify_students !== undefined && notify_students !== '' ? notify_students : null;
    const { rows } = await db.query(
      `UPDATE exams SET
        title = COALESCE($1, title),
        subject = COALESCE($2, subject),
        topic = COALESCE($3, topic),
        start_time = COALESCE($4, start_time),
        duration_minutes = COALESCE($5, duration_minutes),
        notify_students = COALESCE($6, notify_students),
        notify_enabled = CASE WHEN $6::text IS NOT NULL THEN $6::boolean ELSE notify_enabled END,
        show_results = COALESCE($7, show_results),
        updated_at = NOW()
      WHERE id = $8 AND instructor_id = $9
      RETURNING *`,
      [title, subject, topic, startNorm, duration_minutes, ns, show_results, req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Imtahan tapilmadi' });
    res.json({ success: true, exam: rows[0] });
    if (ns !== null || startNorm != null) {
      setImmediate(() => {
        syncExamReminderJob(req.params.id).catch((e) => console.error('syncExamReminderJob', e.message));
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
module.exports = router;
 







































