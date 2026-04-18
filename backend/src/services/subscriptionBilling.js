'use strict';

/**
 * Aylıq postpaid: ankor = yalnız enrollment_start_date (dərslərə başlama günü).
 * Hər ayın həmin günü yeni dövr; cəmi tələb = ay_sayı × aylıq − ödənişlər.
 *
 * Prepaid: ödənişlər − (iştirak slotları × aylıq/8), charges_virtual_balance = TRUE slotlar.
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

function computeSubscriptionState(anchorYmd, untilYmd, monthlyFee, totalPaid) {
  const fee = Number(monthlyFee);
  const paid = Number(totalPaid) || 0;
  if (!anchorYmd || !Number.isFinite(fee) || fee <= 0) {
    return {
      billing_model: 'postpaid',
      subscription_months: 0,
      subscription_due_total: 0,
      subscription_total_paid: roundMoney(paid),
      pending_debt: 0,
      subscription_prepaid: roundMoney(paid),
    };
  }
  const n = countSubscriptionBillingMonths(anchorYmd, untilYmd);
  const dueTotal = roundMoney(n * fee);
  const outstanding = roundMoney(Math.max(0, dueTotal - paid));
  const prepaid = roundMoney(Math.max(0, paid - dueTotal));
  return {
    billing_model: 'postpaid',
    subscription_months: n,
    subscription_due_total: dueTotal,
    subscription_total_paid: roundMoney(paid),
    pending_debt: outstanding,
    subscription_prepaid: prepaid,
  };
}

function computePrepaidWallet(monthlyFee, chargedLessons, totalPaid) {
  const fee = Number(monthlyFee);
  const paid = Number(totalPaid) || 0;
  const n = Math.max(0, Number(chargedLessons) || 0);
  if (!Number.isFinite(fee) || fee <= 0) {
    return {
      billing_model: 'prepaid',
      lesson_unit_price: 0,
      charged_lesson_count: n,
      consumed_amount: 0,
      wallet_balance: roundMoney(paid),
      pending_debt: 0,
      subscription_total_paid: roundMoney(paid),
      subscription_prepaid: roundMoney(paid),
      subscription_months: null,
      subscription_due_total: null,
    };
  }
  const unit = lessonUnitPrice(fee);
  const consumed = roundMoney(n * unit);
  const wallet = roundMoney(paid - consumed);
  return {
    billing_model: 'prepaid',
    lesson_unit_price: unit,
    charged_lesson_count: n,
    consumed_amount: consumed,
    wallet_balance: wallet,
    pending_debt: roundMoney(Math.max(0, -wallet)),
    subscription_total_paid: roundMoney(paid),
    subscription_prepaid: Math.max(0, wallet),
    subscription_months: null,
    subscription_due_total: null,
  };
}

async function getTodayBakuYmd(db) {
  const { rows } = await db.query(
    `SELECT to_char((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Baku')::date, 'YYYY-MM-DD') AS ymd`
  );
  return rows[0]?.ymd || new Date().toISOString().slice(0, 10);
}

function timingIsPrepaid(raw) {
  return String(raw || '').trim().toLowerCase() === 'prepaid';
}

/**
 * Postpaid aylıq: yalnız enrollment_start_date ankoru.
 */
async function loadInstructorMonthlySubscriptionFinancials(db, instructorNormId) {
  const todayBaku = await getTodayBakuYmd(db);
  const { rows } = await db.query(
    `SELECT e.id AS enrollment_id,
            sp.monthly_fee,
            to_char(e.enrollment_start_date::date, 'YYYY-MM-DD') AS anchor_raw
     FROM enrollments e
     INNER JOIN users u ON u.id = e.student_id
     LEFT JOIN student_profiles sp ON sp.user_id = u.id
     WHERE u.role = 'student'
       AND u.is_active = TRUE
       AND e.billing_type = 'monthly'
       AND LOWER(TRIM(COALESCE(e.billing_timing, 'postpaid'))) <> 'prepaid'
       AND REPLACE(LOWER(TRIM(e.instructor_id::text)), '-', '') = $1`,
    [instructorNormId]
  );

  const ids = rows.map((r) => r.enrollment_id);
  const payMap = new Map();
  if (ids.length) {
    const { rows: pays } = await db.query(
      `SELECT enrollment_id, COALESCE(SUM(amount), 0)::numeric AS t
       FROM payments
       WHERE status = 'completed'
         AND enrollment_id = ANY($1::uuid[])
       GROUP BY enrollment_id`,
      [ids]
    );
    for (const p of pays) payMap.set(String(p.enrollment_id), Number(p.t));
  }

  const byEnrollment = new Map();
  let pendingSum = 0;
  for (const r of rows) {
    const anchorYmd = toYmd(r.anchor_raw);
    const fee = r.monthly_fee != null ? Number(r.monthly_fee) : NaN;
    const paid = payMap.get(String(r.enrollment_id)) || 0;
    const state = computeSubscriptionState(anchorYmd, todayBaku, fee, paid);
    pendingSum += state.pending_debt;
    byEnrollment.set(String(r.enrollment_id), {
      enrollment_id: r.enrollment_id,
      monthly_fee: r.monthly_fee,
      anchor_ymd: anchorYmd,
      total_paid: paid,
      ...state,
    });
  }

  return { todayBaku, byEnrollment, pendingSum: roundMoney(pendingSum) };
}

/**
 * Prepaid aylıq: slot borclandırması (charges_virtual_balance).
 */
async function loadInstructorMonthlyPrepaidFinancials(db, instructorNormId) {
  const todayBaku = await getTodayBakuYmd(db);
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
       AND LOWER(TRIM(COALESCE(e.billing_timing, 'postpaid'))) = 'prepaid'
       AND REPLACE(LOWER(TRIM(e.instructor_id::text)), '-', '') = $1`,
    [instructorNormId, todayBaku]
  );

  const byEnrollment = new Map();
  let pendingSum = 0;
  for (const r of rows) {
    const fee = r.monthly_fee != null ? Number(r.monthly_fee) : NaN;
    const paid = Number(r.total_paid) || 0;
    const charged = Number(r.charged_lessons) || 0;
    const state = computePrepaidWallet(fee, charged, paid);
    pendingSum += state.pending_debt;
    byEnrollment.set(String(r.enrollment_id), {
      enrollment_id: r.enrollment_id,
      monthly_fee: r.monthly_fee,
      total_paid: paid,
      charged_lessons: charged,
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
  computeSubscriptionState,
  computePrepaidWallet,
  getTodayBakuYmd,
  timingIsPrepaid,
  loadInstructorMonthlySubscriptionFinancials,
  loadInstructorMonthlyPrepaidFinancials,
};
