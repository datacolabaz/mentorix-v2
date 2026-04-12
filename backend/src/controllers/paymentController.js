const db = require('../utils/db');

/** Tələbə: öz enrollment ödənişləri + aktiv paket məlumatı */
const listMyPayments = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { rows: payments } = await db.query(
      `SELECT p.id, p.amount, p.currency, p.payment_method, p.status, p.period, p.notes, p.paid_at,
              e.billing_type, e.lesson_count AS enrollment_lesson_count,
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

    res.json({ success: true, payments, enrollment: enRows[0] || null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const listPayments = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT p.*, u.full_name AS student_name
       FROM payments p
       JOIN enrollments e ON e.id = p.enrollment_id
       JOIN users u ON u.id = e.student_id
       ORDER BY p.paid_at DESC`
    );
    res.json({ success: true, payments: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const addPayment = async (req, res) => {
  try {
    const { enrollment_id, amount, payment_method, period, notes, status } = req.body;
    const { rows } = await db.query(
      `INSERT INTO payments (enrollment_id, amount, payment_method, period, notes, status)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [enrollment_id, amount, payment_method, period, notes, status || 'completed']
    );
    res.json({ success: true, payment: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { listPayments, addPayment, listMyPayments };
