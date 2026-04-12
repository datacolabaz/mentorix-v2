const router = require('express').Router();
const { listStudents, getStudent, deleteStudent } = require('../controllers/studentController');
const { authenticate, authorize } = require('../middleware/auth');
const db = require('../utils/db');

function sameUuid(a, b) {
  if (a == null || b == null) return false;
  return String(a).replace(/-/g, '').toLowerCase() === String(b).replace(/-/g, '').toLowerCase();
}

function parseMonthlyFee(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function parsePaymentDay(v) {
  if (v === undefined || v === null || v === '') return null;
  const d = parseInt(String(v), 10);
  if (!Number.isFinite(d) || d < 1 || d > 31) return null;
  return d;
}

router.get('/', authenticate, authorize('admin', 'instructor'), listStudents);

router.delete('/enrollment/:enrollmentId', authenticate, authorize('admin', 'instructor'), deleteStudent);

router.post('/enroll', authenticate, authorize('instructor', 'admin'), async (req, res) => {
  try {
    const {
      student_id,
      billing_type,
      referral_notes,
      referral_source_id,
      parent_name,
      parent_phone,
      monthly_fee,
      payment_day,
    } = req.body;
    const instructor_id = req.user.role === 'admin' ? req.body.instructor_id : req.user.id;
    const { rows } = await db.query(
      'INSERT INTO enrollments (instructor_id, student_id, billing_type, referral_notes, referral_source_id) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [instructor_id, student_id, billing_type || '8_lessons', referral_notes, referral_source_id || null]
    );
    const pn = parent_name != null ? String(parent_name).trim() : '';
    const pp = parent_phone != null ? String(parent_phone).trim() : '';
    const mf = parseMonthlyFee(monthly_fee);
    const pd = parsePaymentDay(payment_day);
    const pr = await db.query(
      `UPDATE student_profiles SET
        parent_name = COALESCE(NULLIF($1, ''), parent_name),
        parent_phone = COALESCE(NULLIF($2, ''), parent_phone),
        monthly_fee = $3,
        payment_day = $4
       WHERE user_id = $5`,
      [pn, pp, mf, pd, student_id]
    );
    if (pr.rowCount === 0) {
      await db.query(
        `INSERT INTO student_profiles (user_id, parent_name, parent_phone, monthly_fee, payment_day)
         VALUES ($1, NULLIF($2, ''), NULLIF($3, ''), $4, $5)`,
        [student_id, pn, pp, mf, pd]
      );
    }
    res.json({ success: true, enrollment: rows[0] });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Telebe ve enrollment redakte et
router.patch('/enrollment/:enrollmentId', authenticate, authorize('admin', 'instructor'), async (req, res) => {
  try {
    const {
      full_name,
      email,
      phone,
      billing_type,
      referral_notes,
      parent_name,
      parent_phone,
      monthly_fee,
      payment_day,
    } = req.body;
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
    const hasMf = Object.prototype.hasOwnProperty.call(req.body, 'monthly_fee');
    const hasPd = Object.prototype.hasOwnProperty.call(req.body, 'payment_day');
    const mf = hasMf ? parseMonthlyFee(monthly_fee) : null;
    const pd = hasPd ? parsePaymentDay(payment_day) : null;
    const profUp = await db.query(
      `UPDATE student_profiles SET
        parent_name = NULLIF($1, ''),
        parent_phone = NULLIF($2, ''),
        monthly_fee = CASE WHEN $6 THEN $3::numeric ELSE monthly_fee END,
        payment_day = CASE WHEN $7 THEN $4::integer ELSE payment_day END
       WHERE user_id = $5`,
      [pName, pPhone, mf, pd, studentId, hasMf, hasPd]
    );
    if (profUp.rowCount === 0) {
      await db.query(
        `INSERT INTO student_profiles (user_id, parent_name, parent_phone, monthly_fee, payment_day)
         VALUES ($1, NULLIF($2, ''), NULLIF($3, ''), $4, $5)`,
        [studentId, pName, pPhone, hasMf ? mf : null, hasPd ? pd : null]
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
