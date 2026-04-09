const db = require('../utils/db');

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

module.exports = { listPayments, addPayment };
