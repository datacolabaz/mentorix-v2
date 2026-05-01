const router = require('express').Router();
const {
  getInstructors, updateInstructorLimits,
  getDashboardStats, toggleInstructor,
} = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/auth');
const db = require('../utils/db');

router.get('/stats', authenticate, authorize('admin'), getDashboardStats);
router.get('/instructors', authenticate, authorize('admin'), getInstructors);
router.patch('/instructors/:id/limits', authenticate, authorize('admin'), updateInstructorLimits);
router.patch('/instructors/:id/toggle', authenticate, authorize('admin'), toggleInstructor);


router.patch('/instructors/:id/profile', authenticate, authorize("admin"), async (req, res) => {
  try {
    const { full_name, phone, subject } = req.body;
    await require("../utils/db").query(
      "UPDATE users SET full_name = COALESCE($1, full_name), phone = $2 WHERE id = $3",
      [full_name, phone, req.params.id]
    );
    if (subject !== undefined) {
      await require("../utils/db").query(
        "UPDATE instructor_profiles SET subject = $1 WHERE user_id = $2",
        [subject, req.params.id]
      );
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});


router.patch('/instructors/:id/profile', authenticate, authorize('admin'), async (req, res) => {
  try {
    const db = require('../utils/db');
    const { full_name, phone, subject } = req.body;
    await db.query('UPDATE users SET full_name=$1, phone=$2 WHERE id=$3', [full_name, phone, req.params.id]);
    if (subject !== undefined) {
      await db.query('UPDATE instructor_profiles SET subject=$1 WHERE user_id=$2', [subject, req.params.id]);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});


router.delete('/instructors/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const db = require('../utils/db');
    const id = req.params.id;
    await db.query('DELETE FROM attendance WHERE enrollment_id IN (SELECT id FROM enrollments WHERE instructor_id = $1)', [id]);
    await db.query('DELETE FROM exam_assignments WHERE exam_id IN (SELECT id FROM exams WHERE instructor_id = $1)', [id]);
    await db.query('DELETE FROM exam_results WHERE exam_id IN (SELECT id FROM exams WHERE instructor_id = $1)', [id]);
    await db.query('DELETE FROM exam_questions WHERE exam_id IN (SELECT id FROM exams WHERE instructor_id = $1)', [id]);
    await db.query('DELETE FROM exams WHERE instructor_id = $1', [id]);
    await db.query('DELETE FROM enrollments WHERE instructor_id = $1', [id]);
    await db.query('DELETE FROM instructor_profiles WHERE user_id = $1', [id]);
    await db.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/billing/payments', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { status, limit } = req.query || {};
    const lim = Math.min(200, Math.max(1, parseInt(String(limit || '50'), 10) || 50));
    const st = status ? String(status).trim().toLowerCase() : null;
    const where = st ? 'WHERE bp.status = $1' : '';
    const params = st ? [st, lim] : [lim];
    const sql = `
      SELECT
        bp.id,
        bp.user_id,
        u.full_name,
        u.email,
        bp.plan,
        bp.amount_cents,
        bp.currency,
        bp.status,
        bp.external_order_id,
        bp.created_at,
        bp.paid_at
      FROM billing_payments bp
      LEFT JOIN users u ON u.id = bp.user_id
      ${where}
      ORDER BY bp.created_at DESC
      LIMIT $${st ? 2 : 1}`;
    const { rows } = await db.query(sql, params);
    res.json({ success: true, payments: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
