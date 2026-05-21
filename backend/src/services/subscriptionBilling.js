'use strict';

/**
 * Aylıq sabit borclanma (təqvim ankoru):
 * Dərslərə başlama tarixindən etibarən hər ayın eyni təqvim günü bir dövr sayılır;
 * yaranan borc = dövr sayı × aylıq. Davamiyyət maliyyəyə təsir etmir.
 *
 * Cari balans = tamamlanmış ödənişlərin cəmi − yaranan borc (müsbət = artıq ödəniş).
 */

function pad2(n) {
  return n < 10 ? `0${n}` : String(n);
}

function toYmd(v) {
  if (v == null) return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return toBakuYmd(v);
  }
  const s = String(v);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

/** timestamptz / Date → YYYY-MM-DD (Asia/Baku təqvimi) */
function toBakuYmd(v) {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) {
    const s = String(v);
    const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : null;
  }
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Baku',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function ymdToMs(ymd) {
  const s = String(ymd || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map((x) => parseInt(x, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return Date.UTC(y, m - 1, d, 12, 0, 0);
}

/**
 * Aylıq ankor: əsasən enrollment_start_date; gələcək/yanlış ankor → enrolled_at (Baku günü).
 * enrollment_start_date qeydiyyatdan sonradırsa, borclanma qeydiyyat günündən başlayır (eyni gün 02.09 → eyni dövr).
 */
function resolveMonthlyAnchorYmd({ enrollment_start_date, enrolled_at, today_ymd }) {
  let anchor = toYmd(enrollment_start_date);
  const enrolled = toBakuYmd(enrolled_at);
  const today = today_ymd ? String(today_ymd).slice(0, 10) : null;

  if (!anchor) return enrolled;
  if (enrolled && compareYmd(anchor, enrolled) > 0) {
    anchor = enrolled;
  }
  if (!today) return anchor;
  if (compareYmd(anchor, today) <= 0) return anchor;

  const aMs = ymdToMs(anchor);
  const tMs = ymdToMs(today);
  const eMs = ymdToMs(enrolled);
  if (aMs == null || tMs == null) return anchor;
  const daysAhead = Math.round((aMs - tMs) / 86400000);
  if (daysAhead > 45 && eMs != null && enrolled && compareYmd(enrolled, today) <= 0) return enrolled;
  return anchor;
}

/** Ödəniş tarixini həmin aylıq dövrün ankor gününə map edir (məs. 15.03 → 02.03). */
function canonicalMonthlyDueYmd(anchorYmd, paymentYmd) {
  const anchor = anchorYmd ? String(anchorYmd).slice(0, 10) : null;
  const pd = paymentYmd ? String(paymentYmd).slice(0, 10) : null;
  if (!anchor || !pd || !/^\d{4}-\d{2}-\d{2}$/.test(anchor) || !/^\d{4}-\d{2}-\d{2}$/.test(pd)) {
    return pd;
  }
  if (compareYmd(pd, anchor) < 0) return pd;
  const dues = listBillingDueDatesUpTo(anchor, pd);
  if (!dues.length) return pd;
  let best = dues[0];
  for (const d of dues) {
    if (compareYmd(d, pd) <= 0) best = d;
    else break;
  }
  return best;
}

/**
 * Aylıq tarixçə: ankor üzrə bütün dövrlər (köhnədən yeniyə), ödənilmiş + ödənilməmiş slotlar.
 */
function buildMonthlyPaymentHistoryTimeline({ anchorYmd, todayYmd, monthlyFee, payments }) {
  if (!anchorYmd || !todayYmd) return [];
  const dues = listBillingDueDatesUpTo(anchorYmd, todayYmd);
  const fee = Number(monthlyFee);
  const paidByDue = new Map();

  for (const p of payments || []) {
    const raw = toYmd(p.payment_date) || toBakuYmd(p.paid_at);
    if (!raw) continue;
    const due = canonicalMonthlyDueYmd(anchorYmd, raw);
    if (!due) continue;
    const list = paidByDue.get(due) || [];
    list.push({
      ...p,
      payment_date: due,
      canonical_due_ymd: due,
      timeline_status: 'paid',
    });
    paidByDue.set(due, list);
  }

  const usedPaymentIds = new Set();
  const out = [];

  for (const due of dues) {
    if (compareYmd(due, todayYmd) > 0) continue;
    const paidList = paidByDue.get(due) || [];
    if (paidList.length) {
      for (const p of paidList) {
        if (p.id) usedPaymentIds.add(String(p.id));
        out.push(p);
      }
      continue;
    }
    out.push({
      id: null,
      due_ymd: due,
      payment_date: due,
      amount: Number.isFinite(fee) && fee > 0 ? fee : null,
      currency: 'AZN',
      payment_method: null,
      status: 'pending',
      paid_at: null,
      notes: null,
      period: `Aylıq: ${due}`,
      timeline_status: 'unpaid',
      from_other_enrollment: false,
    });
  }

  for (const p of payments || []) {
    if (p.id && usedPaymentIds.has(String(p.id))) continue;
    const raw = toYmd(p.payment_date) || toBakuYmd(p.paid_at);
    out.push({
      ...p,
      payment_date: raw,
      timeline_status: 'paid',
    });
  }

  out.sort((a, b) => {
    const da = a.payment_date ? String(a.payment_date).slice(0, 10) : '';
    const db = b.payment_date ? String(b.payment_date).slice(0, 10) : '';
    if (da !== db) return compareYmd(da, db);
    if (a.timeline_status === 'unpaid' && b.timeline_status !== 'unpaid') return 1;
    if (b.timeline_status === 'unpaid' && a.timeline_status !== 'unpaid') return -1;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });

  return out;
}

function roundMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
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

function parseYmdUtcNoon(ymd) {
  const p = parseYmdParts(ymd);
  if (!p) return null;
  return new Date(Date.UTC(p.y, p.mo - 1, p.d, 12, 0, 0));
}

function diffDaysYmd(aYmd, bYmd) {
  const a = parseYmdUtcNoon(aYmd);
  const b = parseYmdUtcNoon(bYmd);
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function addCalendarMonthsYmd(ymd, months) {
  const p = parseYmdParts(ymd);
  if (!p) return null;
  const idx = (p.y * 12 + (p.mo - 1)) + Number(months || 0);
  const y = Math.floor(idx / 12);
  const mo = (idx % 12) + 1;
  return { y, mo };
}

/**
 * Cari dövrün başlanğıc/bitmə tarixləri (Baku YMD), ankora görə.
 * Dövr [cycle_start, cycle_end) kimi götürülür.
 */
function computeMonthlyCycleProgress({ anchor_ymd, today_ymd }) {
  const anchorYmd = anchor_ymd ? String(anchor_ymd).slice(0, 10) : null;
  const todayYmd = today_ymd ? String(today_ymd).slice(0, 10) : null;
  const ap = parseYmdParts(anchorYmd);
  if (!ap || !todayYmd) return null;

  // Əgər ankor gələcəkdədirsə, hələ dövr başlamayıb.
  if (compareYmd(anchorYmd, todayYmd) > 0) {
    // Cycle is [anchor, next_anchor) even if anchor is in the future.
    const nextMonth = addCalendarMonthsYmd(anchorYmd, 1);
    const endYmd = nextMonth ? billingYmdForCalendarMonth(nextMonth.y, nextMonth.mo, ap.d) : null;
    const total = diffDaysYmd(anchorYmd, endYmd);
    return {
      cycle_start_ymd: anchorYmd,
      cycle_end_ymd: endYmd,
      days_elapsed: 0,
      days_total: Number.isFinite(total) ? total : null,
      days_remaining: Number.isFinite(total) ? total : null,
      next_billing_ymd: anchorYmd,
    };
  }

  const dueDates = listBillingDueDatesUpTo(anchorYmd, todayYmd);
  const cycleStart = dueDates.length ? dueDates[dueDates.length - 1] : anchorYmd;
  const sp = parseYmdParts(cycleStart);
  if (!sp) return null;

  const nextMonth = addCalendarMonthsYmd(cycleStart, 1);
  const cycleEnd = nextMonth ? billingYmdForCalendarMonth(nextMonth.y, nextMonth.mo, ap.d) : null;
  if (!cycleEnd) return null;

  const total = diffDaysYmd(cycleStart, cycleEnd);
  let elapsed = diffDaysYmd(cycleStart, todayYmd);
  if (!Number.isFinite(elapsed)) elapsed = 0;
  if (Number.isFinite(total)) elapsed = Math.min(Math.max(0, elapsed), total);
  const remaining = Number.isFinite(total) ? Math.max(0, total - elapsed) : null;

  return {
    cycle_start_ymd: cycleStart,
    cycle_end_ymd: cycleEnd,
    days_elapsed: elapsed,
    days_total: Number.isFinite(total) ? total : null,
    days_remaining: remaining,
    next_billing_ymd: cycleEnd,
  };
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

/**
 * @param {object} p
 * @param {number|string} p.monthly_fee
 * @param {string|null} p.anchor_ymd
 * @param {string|null} p.today_ymd
 * @param {number|string} p.total_paid
 */
function computeMonthlyBalanceState({ monthly_fee, anchor_ymd, today_ymd, total_paid }) {
  const fee = Number(monthly_fee);
  const paid = roundMoney(Number(total_paid) || 0);
  const anchorYmd = anchor_ymd ? String(anchor_ymd).slice(0, 10) : null;
  const todayYmd = today_ymd ? String(today_ymd).slice(0, 10) : null;

  /** Ankor tarixi bu gündən sonradırsa — heç bir dövr borcu yaranmayıb; öncədən ödənilənlər "artıq balans" sayılmır */
  if (anchorYmd && todayYmd && compareYmd(anchorYmd, todayYmd) > 0) {
    return {
      accrued_total: 0,
      total_payments: paid,
      net_balance: 0,
      pending_debt: 0,
      wallet_balance: 0,
      subscription_due_total: 0,
      subscription_total_paid: paid,
      subscription_prepaid: 0,
      subscription_months: 0,
      billing_model: 'monthly_anchor',
      payment_status: 'ödənilib',
      billing_anchor_future: true,
    };
  }

  let monthsCount = 0;
  let accrued = 0;
  if (anchorYmd && Number.isFinite(fee) && fee > 0 && todayYmd) {
    monthsCount = countSubscriptionBillingMonths(anchorYmd, todayYmd);
    accrued = roundMoney(monthsCount * fee);
  }

  const netBalance = roundMoney(paid - accrued);
  const owe = roundMoney(Math.max(0, accrued - paid));

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
    subscription_months: monthsCount,
    billing_model: 'monthly_anchor',
    payment_status,
    billing_anchor_future: false,
  };
}

async function getTodayBakuYmd(db) {
  const { rows } = await db.query(
    `SELECT to_char((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Baku')::date, 'YYYY-MM-DD') AS ymd`
  );
  return rows[0]?.ymd || new Date().toISOString().slice(0, 10);
}

/** Bütün aylıq tələbələr üçün sorğu + balans (müəllim paneli, dashboard). */
async function loadInstructorMonthlyBalanceRows(db, instructorNormId) {
  const todayBaku = await getTodayBakuYmd(db);
  const { rows } = await db.query(
    `WITH pays AS (
       SELECT enrollment_id, COALESCE(SUM(amount), 0)::numeric AS t
       FROM payments
       WHERE status = 'completed'
         AND (deleted_at IS NULL)
       GROUP BY enrollment_id
     )
     SELECT e.id AS enrollment_id,
            sp.monthly_fee,
            to_char(e.enrollment_start_date::date, 'YYYY-MM-DD') AS anchor_raw,
            e.enrolled_at,
            COALESCE(p.t, 0)::numeric AS total_paid
     FROM enrollments e
     INNER JOIN users u ON u.id = e.student_id
     LEFT JOIN student_profiles sp ON sp.user_id = u.id
     LEFT JOIN pays p ON p.enrollment_id = e.id
     WHERE u.role = 'student'
       AND u.is_active = TRUE
       AND e.billing_type = 'monthly'
       AND REPLACE(LOWER(TRIM(e.instructor_id::text)), '-', '') = $1`,
    [instructorNormId]
  );

  const byEnrollment = new Map();
  let pendingSum = 0;
  for (const r of rows) {
    const anchorYmd = resolveMonthlyAnchorYmd({
      enrollment_start_date: r.anchor_raw,
      enrolled_at: r.enrolled_at,
      today_ymd: todayBaku,
    });
    const state = computeMonthlyBalanceState({
      monthly_fee: r.monthly_fee,
      anchor_ymd: anchorYmd,
      today_ymd: todayBaku,
      total_paid: r.total_paid,
    });
    pendingSum += state.pending_debt;
    byEnrollment.set(String(r.enrollment_id), {
      enrollment_id: r.enrollment_id,
      monthly_fee: r.monthly_fee,
      anchor_ymd: anchorYmd,
      ...state,
    });
  }

  return { todayBaku, byEnrollment, pendingSum: roundMoney(pendingSum) };
}

module.exports = {
  toYmd,
  toBakuYmd,
  ymdToMs,
  resolveMonthlyAnchorYmd,
  canonicalMonthlyDueYmd,
  buildMonthlyPaymentHistoryTimeline,
  roundMoney,
  compareYmd,
  listBillingDueDatesUpTo,
  countSubscriptionBillingMonths,
  computeMonthlyBalanceState,
  computeMonthlyCycleProgress,
  getTodayBakuYmd,
  loadInstructorMonthlyBalanceRows,
};
