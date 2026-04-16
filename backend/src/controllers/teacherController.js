const db = require('../utils/db');

const getTeacherDashboardStats = async (req, res) => {
  try {
    const instructorId = req.user.id;

    // Current month window (Postgres)
    const monthStartSql = "date_trunc('month', NOW())";

    const lessonsQ = db.query(
      `SELECT COALESCE(COUNT(a.id), 0)::int AS lessons_this_month
       FROM attendance a
       JOIN enrollments e ON e.id = a.enrollment_id
       WHERE e.instructor_id = $1
         AND a.date >= ${monthStartSql}`,
      [instructorId],
    );

    const incomeQ = db.query(
      `SELECT COALESCE(SUM(p.amount), 0)::numeric AS income_this_month
       FROM payments p
       JOIN enrollments e ON e.id = p.enrollment_id
       WHERE e.instructor_id = $1
         AND p.status = 'completed'
         AND COALESCE(p.payment_date::timestamptz, p.paid_at, NOW()) >= ${monthStartSql}`,
      [instructorId],
    );

    const [{ rows: lessonRows }, { rows: incomeRows }] = await Promise.all([lessonsQ, incomeQ]);

    res.json({
      success: true,
      stats: {
        lessons_this_month: lessonRows[0]?.lessons_this_month ?? 0,
        income_this_month: Number(incomeRows[0]?.income_this_month ?? 0),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getTeacherDashboardStats };

