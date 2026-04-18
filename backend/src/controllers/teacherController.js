const db = require('../utils/db');
const { countUnpaidBillingPeriods } = require('../utils/monthlyBillingPeriods');

function normUuid(id) {
  return String(id).trim().toLowerCase().replace(/-/g, '');
}

function toYmd(v) {
  if (v == null) return null;
  const s = String(v);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
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

    const todayQ = db.query(
      `SELECT to_char((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Baku')::date, 'YYYY-MM-DD') AS ymd`
    );

    const monthlyEnrQ = db.query(
      `SELECT e.id AS enrollment_id, sp.monthly_fee,
              COALESCE(e.enrollment_start_date, sp.payment_start_date::date) AS payment_start_date
       FROM enrollments e
       INNER JOIN users u ON u.id = e.student_id
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
       WHERE u.role = 'student' AND u.is_active = TRUE
         AND e.billing_type = 'monthly'
         AND REPLACE(LOWER(TRIM(e.instructor_id::text)), '-', '') = $1`,
      [iid],
    );

    const [{ rows: incomeRows }, { rows: totalRows }, { rows: todayRows }, { rows: mrows }] = await Promise.all([
      incomeQ,
      totalQ,
      todayQ,
      monthlyEnrQ,
    ]);

    const todayBaku = todayRows[0]?.ymd || new Date().toISOString().slice(0, 10);
    const monthlyIds = mrows.map((r) => r.enrollment_id);
    const payByEnr = new Map();
    if (monthlyIds.length) {
      const { rows: payRows } = await db.query(
        `SELECT p.enrollment_id, p.payment_date, p.paid_at, p.period, p.notes, p.status
         FROM payments p
         WHERE p.enrollment_id = ANY($1::uuid[]) AND p.status = 'completed'`,
        [monthlyIds]
      );
      for (const p of payRows) {
        if (!payByEnr.has(p.enrollment_id)) payByEnr.set(p.enrollment_id, []);
        payByEnr.get(p.enrollment_id).push(p);
      }
    }

    let pendingMonthlyTotal = 0;
    for (const r of mrows) {
      const feeNum = r.monthly_fee != null ? Number(r.monthly_fee) : NaN;
      if (!Number.isFinite(feeNum) || feeNum <= 0) continue;
      const anchor = toYmd(r.payment_start_date);
      if (!anchor) continue;
      const pays = payByEnr.get(r.enrollment_id) || [];
      const unpaid = countUnpaidBillingPeriods(anchor, todayBaku, pays);
      pendingMonthlyTotal += unpaid * feeNum;
    }

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

