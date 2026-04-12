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
      'INSERT INTO enrollments (instructor_id, student_id, billing_type, referral_notes, referral_source_id) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [instructor_id, student_id, billing_type || '8_lessons', referral_notes, referral_source_id || null]
    );
    res.json({ success: true, enrollment: rows[0] });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
 
// Telebe ve enrollment redakte et
router.patch('/enrollment/:enrollmentId', authenticate, authorize('admin', 'instructor'), async (req, res) => {
  try {
    const { full_name, email, phone, billing_type, referral_notes, parent_name, parent_phone } = req.body;
    const { enrollmentId } = req.params;
 
    // Enrollment-dan student_id tap
    const { rows: enrRows } = await db.query(
      'SELECT student_id FROM enrollments WHERE id = $1', [enrollmentId]);
    if (!enrRows[0]) return res.status(404).json({ success: false, message: 'Enrollment tapilmadi' });
    const studentId = enrRows[0].student_id;
 
    // User melumatlarini yenile
    await db.query(
      'UPDATE users SET full_name = $1, email = $2, phone = $3 WHERE id = $4',
      [full_name, email || null, phone, studentId]
    );
 
    // Enrollment melumatlarini yenile
    await db.query(
      'UPDATE enrollments SET billing_type = $1, referral_notes = $2 WHERE id = $3',
      [billing_type, referral_notes, enrollmentId]
    );
 
    // Valideyn melumatlarini yenile (varsa)
    if (parent_name || parent_phone) {
      await db.query(
        `UPDATE student_profiles SET 
          parent_name = COALESCE($1, parent_name),
          parent_phone = COALESCE($2, parent_phone)
         WHERE user_id = $3`,
        [parent_name, parent_phone, studentId]
      );
    }
 
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
 
router.patch('/:id/phone', authenticate, authorize('admin', 'instructor'), async (req, res) => {
  try {
    const { phone } = req.body;
    await db.query('UPDATE users SET phone = $1 WHERE id = $2', [phone, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
 
module.exports = router;
 
