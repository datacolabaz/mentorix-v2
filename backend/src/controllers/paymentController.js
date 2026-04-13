const db = require('../utils/db');

function normUuid(id) {
  return String(id).trim().toLowerCase().replace(/-/g, '');
}

function sameUuid(a, b) {
  if (a == null || b == null) return false;
  return normUuid(a) === normUuid(b);
}

function billingLimit(type) {
  if (type === '8_lessons') return 8;
  if (type === '12_lessons') return 12;
  return null;
}

/** Tələbə: öz enrollment ödənişləri + aktiv paket məlumatı */
const listMyPayments = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { rows: payments } = await db.query(
      `SELECT p.id, p.amount, p.currency, p.payment_method, p.status, p.period, p.notes, p.paid_at, p.payment_date,
              p.billing_cycle,
              e.billing_type, e.lesson_count AS enrollment_lesson_count, e.billing_cycle AS enrollment_billing_cycle,
              iu.full_name AS instructor_name
       FROM payments p
       INNER JOIN enrollments e ON e.id = p.enrollment_id AND e.student_id = $1
       LEFT JOIN users iu ON iu.id = e.instructor_id
       ORDER BY p.paid_at DESC NULLS LAST`,
      [studentId]
    );

    const { rows: enRows } = await db.query(
      `SELECT e.*, iu.full_name AS instructor_name
       FROM enrollments e
       LEFT JOIN users iu ON iu.id = e.instructor_id
       WHERE e.student_id = $1 AND e.status = 'active'
       ORDER BY e.enrolled_at DESC NULLS LAST
       LIMIT 1`,
      [studentId]
    );

    const enrollment = enRows[0] || null;
    const limit = enrollment ? billingLimit(enrollment.billing_type) : null;
    const remaining_lessons =
      enrollment && limit != null ? Math.max(0, Number(limit) - Number(enrollment.lesson_count || 0)) : null;

    res.json({
      success: true,
      payments,
      enrollment: enrollment ? { ...enrollment, lesson_limit: limit, remaining_lessons } : null,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const listPayments = async (req, res) => {
  try {
    let sql = `SELECT p.*, u.full_name AS student_name
       FROM payments p
       JOIN enrollments e ON e.id = p.enrollment_id
       JOIN users u ON u.id = e.student_id`;
    const params = [];
    if (req.user.role === 'instructor'