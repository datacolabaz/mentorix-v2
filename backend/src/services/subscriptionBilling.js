'use strict';

/**
 * Aylıq ödəniş növü (enrollments.billing_timing):
 * - prepaid (Əvvəlcədən): yaranan borc = ankor ayları × aylıq (başlama gününün təqvim günü).
 * - postpaid (Sonradan): yaranan borc = keçmişdə iştirak olunmuş dərs slotları × (aylıq÷8).
 *
 * Cari balans = tamamlanmış ödənişlərin cəmi − yaranan borc (müsbət = artıq ödəniş).
 */

const LESSON_UNITS_PER_MONTH = 8;

function pad2(n) {
  return n < 10 ? `0${n}` : String(n);
}

function toYmd(v) {
  if (v == null) return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  const s = String(v);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function roundMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
}

function lessonUnitPrice(monthlyFee) {
  const f = Number(monthlyFee);
  if (!Number.isFinite(f) || f <= 0) return 0;
  return Math.round((f / LESSON_UNITS_PER_MONTH) * 10000) / 10000;
}

function parseYmdParts(ymd) {
  if (!ymd) return null;
  const m = String(ymd).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return { y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]) };
}

function compareYmd(aStr, bStr) {
  if (aStr < bStr) return -1;
  if (aStr > bStr) return 1;
  return 0;
}

function lastDayOfMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function billingYmdForCalendarMonth(year, month, anchorDay) {
  const last = lastDayOfMonth(year, month);
  const day = Math.min(anchorDay, last);
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function listBillingDueDatesUpTo(anchorYmd, untilYmd) {
  const ap = parseYmdParts(anchorYmd);
  if (!ap || !untilYmd || !/^\d{4}-\d{2}-\d{2}$/.test(String(untilYmd).slice(0, 10))) return [];
  const until = String(untilYmd).slice(0, 10);
  const anchorDay = ap.d;
  const out = [];
  let y = ap.y;
  let mo = ap.mo;
  for (;;) {
    const cur = billingYmdForCalendarMonth(y, mo, anchorDay);
    if (compareYmd(cur, until) > 0) break;
    out.push(cur);
    if (mo === 12) {
      y += 1;
      mo = 1;
    } else {
      mo += 1;
    }
  }
  return out;
}

function countSubscriptionBillingMonths(anchorYmd, untilYmd) {
  return listBillingDueDatesUpTo(anchorYmd, untilYmd).length;
}

function timingIsPrepaid(raw) {
  return String(raw || '').trim().toLowerCase() === 'prepaid';
}

/**
 * @param {object} p
 * @param {string} p.billing_timing
 * @param {number|string} p.monthly_fee
 * @param {string|null} p.anchor_ymd
 * @param {string|null} p.today_ymd
 * @param {number} p.attended_lessons
 * @param {number|string} p.total_paid
 */
function computeMonthlyBalanceState({
  billing_timing,
  monthly_fee,
  anchor_ymd,
  today_ymd,
  attended_lessons,
  total_paid,
}) {
  const fee = Number(monthly_fee);
  const paid = roundMoney(Number(total_paid) || 0);
  const attended = Math.max(0, Number(attended_lessons) || 0);
  const anchorYmd = anchor_ymd ? String(anchor_ymd).slice(0, 10) : null;
  const todayYmd = today_ymd ? String(today_ymd).slice(0, 10) : null;
  const prepaid = timingIsPrepaid(billing_timing);

  let accrued = 0;
  let monthsCount = 0;
  if (prepaid) {
    if (anchorYmd && Number.isFinite(fee) && fee > 0 && todayYmd) {
      monthsCount = countSubscriptionBillingMonths(anchorYmd, todayYmd);
      accrued = roundMoney(monthsCount * fee);
    }
  } else {
    const unit = lessonUnitPrice(fee);
    accrued = roundMoney(attended * unit);
  }

  const netBalance = roundMoney(paid - accrued);
  const owe = roundMoney(Math.max(0, accrued - paid));
  const unit = lessonUnitPrice(fee);

  const eps = 0.005;
  let payment_status = 'ödənilib';
  if (owe > eps) {
    payment_status = paid > eps ? 'gözlənilir' : 'borclu';
  }

  return {
    accrued_total: accrued,
    total_payments: paid,
    net_balance: netBalance,
    pending_debt: owe,
    wallet_balance: roundMoney(Math.max(0, netBalance)),
    subscription_due_total: accrued,
    subscription_total_paid: paid,
    subscription_prepaid: roundMoney(Math.max(0, netBalance)),
    subscription_months: prepaid ? monthsCount : null,
    charged_lesson_count: prepaid ? null : attended,
    lesson_unit_price: prepaid ? null : unit,
    consumed_amount: prepaid ? null : accrued,
    billing_model: prepaid ? 'prepaid' : 'postpaid',
    payment_status,
  };
}

async function getTodayBakuYmd(db) {
  const { rows } = await db.query(
    `SELECT to_char((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Baku')::date, 'YYYY-MM-DD') AS ymd`
  );
  return rows[0]?.ymd || new Date().toISOString().slice(0, 10);
}

/** Bütün aylıq tələbələr üçün vahid sorğu + balans (müəllim paneli, dashboard). */
async function loadInstructorMonthlyBalanceRows(db, instructorNormId) {
  const todayBaku = await getTodayBakuYmd(db);
  const { rows } = await db.query(
    `WITH attended AS (
       SELECT enrollment_id, COUNT(*)::int AS n
       FROM monthly_attendance_slots
       WHERE lesson_date <= $2::date
         AND status = 'attended'
       GROUP BY enrollment_id
     ),
     pays AS (
       SELECT enrollment_id, COALESCE(SUM(amount), 0)::numeric AS t
       FROM payments
       WHERE status = 'completed'
       GROUP BY enrollment_id
     )
     SELECT e.id AS enrollment_id,
            sp.monthly_fee,
            to_char(e.enrollment_start_date::date, 'YYYY-MM-DD') AS anchor_raw,
            LOWER(TRIM(COALESCE(e.billing_timing, 'postpaid'))) AS billing_timing,
            COALESCE(a.n, 0)::int AS attended_lessons,
            COALESCE(p.t, 0)::numeric AS total_paid
     FROM enrollments e
     INNER JOIN users u ON u.id = e.student_id
     LEFT JOIN student_profiles sp ON sp.user_id = u.id
     LEFT JOIN attended a ON a.enrollment_id = e.id
     LEFT JOIN pays p ON p.enrollment_id = e.id
     WHERE u.role = 'student'
       AND u.is_active = TRUE
       AND e.billing_type = 'monthly'
       AND REPLACE(LOWER(TRIM(e.instructor_id::text)), '-', '') = $1`,
    [instructorNormId, todayBaku]
  );

  const byEnrollment = new Map();
  let pendingSum = 0;
  for (const r of rows) {
    const anchorYmd = toYmd(r.anchor_raw);
    const state = computeMonthlyBalanceState({
      billing_timing: r.billing_timing,
      monthly_fee: r.monthly_fee,
      anchor_ymd: anchorYmd,
      today_ymd: todayBaku,
      attended_lessons: r.attended_lessons,
      total_paid: r.total_paid,
    });
    pendingSum += state.pending_debt;
    byEnrollment.set(String(r.enrollment_id), {
      enrollment_id: r.enrollment_id,
      monthly_fee: r.monthly_fee,
      anchor_ymd: anchorYmd,
      billing_timing: r.billing_timing,
      attended_lessons: r.attended_lessons,
      ...state,
    });
  }

  return { todayBaku, byEnrollment, pendingSum: roundMoney(pendingSum) };
}

module.exports = {
  LESSON_UNITS_PER_MONTH,
  lessonUnitPrice,
  toYmd,
  roundMoney,
  listBillingDueDatesUpTo,
  countSubscriptionBillingMonths,
  computeMonthlyBalanceState,
  getTodayBakuYmd,
  timingIsPrepaid,
  loadInstructorMonthlyBalanceRows,
};
