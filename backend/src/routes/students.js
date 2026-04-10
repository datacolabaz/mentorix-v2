const router = require('express').Router();
const { listStudents, getStudent, deleteStudent } = require('../controllers/studentController');
const { authenticate, authorize } = require('../middleware/auth');
const db = require('../utils/db');

router.get('/', authenticate, authorize('admin', 'instructor'), listStudents);
router.get('/:id', authenticate, getStudent);
router.delete('/enrollment/:enrollmentId', authenticate, authorize('admin', 'instructor'), deleteStudent);

router.post('/enroll', authenticate, authorize('instructor', 'admin'), async (req, res) => {
  try {
    const { student_id, billing_type, referral_notes, referral_source_id } = req.body;
    const instructor_id = req.user.role === 'admin' ? req.body.instructor_id : req.user.id;

    const { rows } = await db.query(
      `INSERT INTO enrollments (instructor_id, student_id, billing_type, referral_notes, referral_source_id)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [instructor_id, student_id, billing_type || '8_lessons', referral_notes, referral_source_id || null]
    );
    res.json({ success: true, enrollment: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
