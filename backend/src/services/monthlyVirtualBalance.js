'use strict';

/** Aylıq məbləğ 8 dərs vahidinə bölünür (Virtual balans). */
const LESSON_UNITS_PER_MONTH = 8;

function lessonUnitPrice(monthlyFee) {
  const f = Number(monthlyFee);
  if (!Number.isFinite(f) || f <= 0) return 0;
  return Math.round((f / LESSON_UNITS_PER_MONTH) * 10000) / 10000;
}

function roundMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
}

function computeVirtualFromParts(monthlyFee, chargedLessons, totalPaid) {
  const unit = lessonUnitPrice(monthlyFee);
  const n = Math.max(0, Number(chargedLessons) || 0);
  const paid = Number(totalPaid) || 0;
  const consumed = roundMoney(n * unit);
  const balance = roundMoney(paid - consumed);
  const pendingDebt = balance < 0 ? roundMoney(-balance) : 0;
  return {
    lesson_unit_price: unit,
    charged_lesson_count: n,
    consumed_amount: consumed,
    total_paid: roundMoney(paid),
    virtual_balance: balance,
    pending_debt: pendingDebt,
  };
}

/**
 * Müəllim üçün bütün aylıq enrollment-lar: slot sayı + ödəniş cəmi (Bakı bu günə qədər slotlar).
 */
async function loadInstructorMonthlyVirtualBaseRows(db, instructorNormId) {
  const { rows: tr } = await db.query(
    `SELECT to_char((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Baku')::date, 'YYYY-MM-DD') AS ymd`
  );
  const todayBaku = tr[0]?.ymd || new Date().toISOString().slice(0, 10);

  const { rows } = await db.query(
    `WITH slots AS (
       SELECT enrollment_id, COUNT(*)::int AS n
       FROM monthly_attendance_slots
       WHERE lesson_date <= $2::date
         AND charges_virtual_balance = TRUE
       GROUP BY enrollment_id
     ),
     pays AS (
       SELECT enrollment_id, COALESCE(SUM(amount), 0)::numeric AS t
       FROM payments
       WHERE status = 'completed'
       GROUP BY enrollment_id
     )
     SELECT e.id AS enrollment_id,
            e.student_id,
            sp.monthly_fee,
            COALESCE(sl.n, 0)::int AS charged_lessons,
            COALESCE(py.t, 0)::numeric AS total_paid
     FROM enrollments e
     INNER JOIN users u ON u.id = e.student_id
     LEFT JOIN student_profiles sp ON sp.user_id = u.id
     LEFT JOIN slots sl ON sl.enrollment_id = e.id
     LEFT JOIN pays py ON py.enrollment_id = e.id
     WHERE u.role = 'student'
       AND u.is_active = TRUE
       AND e.billing_type = 'monthly'
       AND REPLACE(LOWER(TRIM(e.instructor_id::text)), '-', '') = $1`,
    [instructorNormId, todayBaku]
  );

  return { todayBaku, rows };
}

function sumPendingDebtFromRows(rows) {
  let s = 0;
  for (const r of rows) {
    const fee = r.monthly_fee != null ? Number(r.monthly_fee) : NaN;
    if (!Number.isFinite(fee) || fee <= 0) continue;
    const { pending_debt } = computeVirtualFromParts(fee, r.charged_lessons, r.total_paid);
    s += pending_debt;
  }
  return roundMoney(s);
}

module.exports = {
  LESSON_UNITS_PER_MONTH,
  lessonUnitPrice,
  roundMoney,
  computeVirtualFromParts,
  loadInstructorMonthlyVirtualBaseRows,
  sumPendingDebtFromRows,
};
