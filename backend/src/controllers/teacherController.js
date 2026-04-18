const db = require('../utils/db');
const { loadInstructorMonthlyVirtualBaseRows, sumPendingDebtFromRows } = require('../services/monthlyVirtualBalance');

function normUuid(id) {
  return String(id).trim().toLowerCase().replace(/-/g, '');
}

const getTeacherDashboardStats = async (req, res) => {
  try {
    const instructorId = req.user.id;
    const iid = normUuid(instructorId);

    const monthStartSql = "date_trunc('month', NOW())";

    const incomeQ = db.query(
      `SELECT COALESCE(SUM(p.amount), 0)::numeric AS income_this_month
       FROM payments p
       JOIN enrollments e ON e.id = p.enrollment_id
       WHERE REPLACE(LOWER(TRIM(e.instructor_id::text)), '-', '') = $1
         AND p.status = 'completed'
         AND COALESCE(p.payment_date::timestamptz, p.paid_at, NOW()) >= ${monthStartSql}`,
      [iid],
    );

    const totalQ = db.query(
      `SELECT COALESCE(SUM(p.amount), 0)::numeric AS total_earnings_all
       FROM payments p
       JOIN enrollments e ON e.id = p.enrollment_id
       WHERE REPLACE(LOWER(TRIM(e.instructor_id::text)), '-', '') = $1
         AND p.status = 'completed'`,
      [iid],
    );

    const [{ rows: incomeRows }, { rows: totalRows }] = await Promise.all([incomeQ, totalQ]);

    const { rows: vrows } = await loadInstructorMonthlyVirtualBaseRows(db, iid);
    const pendingMonthlyTotal = sumPendingDebtFromRows(vrows);

    res.json({
      success: true,
      stats: {
        income_this_month: Number(incomeRows[0]?.income_this_month ?? 0),
        total_earnings_all: Number(totalRows[0]?.total_earnings_all ?? 0),
        pending_monthly_total: Math.round(pendingMonthlyTotal * 100) / 100,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getTeacherDashboardStats };

