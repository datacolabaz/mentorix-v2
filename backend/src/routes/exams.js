const router = require('express').Router();
const {
  createExam, listExams, studentExams,
  getExamQuestions, submitExam, getResults,
} = require('../controllers/examController');
const { authenticate, authorize } = require('../middleware/auth');
const db = require('../utils/db');
 
router.post('/', authenticate, authorize('instructor', 'admin'), createExam);
router.get('/', authenticate, authorize('instructor', 'admin'), listExams);
router.get('/my', authenticate, authorize('student'), studentExams);
router.get('/:id/questions', authenticate, getExamQuestions);
router.post('/submit', authenticate, authorize('student'), submitExam);
router.get('/:id/results', authenticate, getResults);
 
// Imtahani edit et
router.patch('/:id', authenticate, authorize('instructor', 'admin'), async (req, res) => {
  try {
    const { title, subject, topic, start_time, duration_minutes, notify_students, show_results } = req.body;
    const { rows } = await db.query(
      `UPDATE exams SET
        title = COALESCE($1, title),
        subject = COALESCE($2, subject),
        topic = COALESCE($3, topic),
        start_time = COALESCE($4, start_time),
        duration_minutes = COALESCE($5, duration_minutes),
        notify_students = COALESCE($6, notify_students),
        show_results = COALESCE($7, show_results),
        updated_at = NOW()
      WHERE id = $8 AND instructor_id = $9
      RETURNING *`,
      [title, subject, topic, start_time, duration_minutes, notify_students, show_results, req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Imtahan tapilmadi' });
    res.json({ success: true, exam: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
module.exports = router;
 
