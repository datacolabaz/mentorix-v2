const router = require('express').Router();
const { listStudents, getStudent, deleteStudent } = require('../controllers/studentController');
const { authenticate, authorize } = require('../middleware/auth');
const db = require('../utils/db');

function sameUuid(a, b) {
  if (a == null || b == null) return false;
  return String(a).replace(/-/g, '').toLowerCase() === String(b).replace(/-/g, '').toLowerCase();
}

router.get('/', authenticate, authorize('admin', 'instructor'), listStudents);

router.delete('/enrollment/:enrollmentId', authenticate, authorize('admin', 'instructor'), deleteStudent);

router.post('/enroll', authenticate, authorize('instructor', 'admin'), async (req, res) => {
  try {
    const { student_id, billing_type, referral_notes, referral_source_id, parent_name, parent_phone } = req.body;
    const instructor_id = req.user.role === 'admin' ? req.body.instructor_id : req.user.id;
    const { rows } = await db.query(
      'INSERT INTO enrollments (instructor_id, student_id, billing_type, referral_notes, referral_source_id) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [instructor_id, student_id, billing_type || '8_lessons', referral_notes, referral_source_id || null]
    );
    const pn = parent_name != null ? String(parent_name).trim() : '';
    const pp = parent_phone != null ? String(parent_phone).trim() : '';
    if (pn || pp) {
      const pr = await db.query(
        `UPDATE student_profiles SET parent_name = NULLIF($1, ''), parent_phone = NULLIF($2, '') WHERE user_id = $3`,
        [pn, pp, student_id]
      );
      if (pr.rowCount === 0) {
        await db.query(
          `INSERT INTO student_profiles (user_id, parent_name, parent_phone) VALUES ($1, NULLIF($2, ''), NULLIF($3, ''))`,
          [student_id, pn, pp]
        );
      }
    }
    res.json({ success: true, enrollment: rows[0] });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Telebe ve enrollment redakte et
router.patch('/enrollment/:enrollmentId', authenticate, authorize('admin', 'instructor'), async (req, res) => {
  try {
    const { full_name, email, phone, billing_type, referral_notes, parent_name, parent_phone } = req.body;
    const { enrollmentId } = req.params;

    const { rows: enrRows } = await db.query(
      'SELECT student_id, instructor_id FROM enrollments WHERE id = $1',
      [enrollmentId]
    );
    if (!enrRows[0]) return res.status(404).json({ success: false, message: 'Enrollment tapilmadi' });
    const { student_id: studentId, instructor_id: enrollmentInstructorId } = enrRows[0];

    if (req.user.role === 'instructor' && !sameUuid(enrollmentInstructorId, req.user.id)) {
      return res.status(403).json({ success: false, message: 'Bu qeydiyyata icazəniz yoxdur' });
    }

    await db.query(
      'UPDATE users SET full_name = $1, email = $2, phone = $3 WHERE id = $4',
      [full_name, email || null, phone, studentId]
    );

    await db.query(
      'UPDATE enrollments SET billing_type = $1, referral_notes = $2 WHERE id = $3',
      [billing_type, referral_notes || null, enrollmentId]
    );

    const pName = parent_name != null ? String(parent_name).trim() : '';
    const pPhone = parent_phone != null ? String(parent_phone).trim() : '';
    const profUp = await db.query(
      `UPDATE student_profiles SET
        parent_name = NULLIF($1, ''),
        parent_phone = NULLIF($2, '')
       WHERE user_id = $3`,
      [pName, pPhone, studentId]
    );
    if (profUp.rowCount === 0) {
      await db.query(
        `INSERT INTO student_profiles (user_id, parent_name, parent_phone)
         VALUES ($1, NULLIF($2, ''), NULLIF($3, ''))`,
        [studentId, pName, pPhone]
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

router.get('/:id', authenticate, getStudent);

module.exports = router;
