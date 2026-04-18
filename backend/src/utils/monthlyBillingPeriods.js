'use strict';

/** YYYY-MM-DD */
function parseYmd(v) {
  if (v === undefined || v === null || v === '') return null;
  const s = String(v).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

function toYmdFromDb(val) {
  if (val == null) return null;
  const s = String(val);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

/**
 * Ankor tarixdən n ay irəli: eyni təqvim günü (ayın sonu ilə məhdudlaşır).
 * Məs: 2025-09-03 + 1 → 2025-10-03; 2025-01-31 + 1 → 2025-02-28
 */
function addMonthsFromAnchor(anchorYmd, nMonths) {
  const anchor = parseYmd(anchorYmd);
  if (anchor == null || !Number.isFinite(nMonths) || nMonths < 0) return null;
  const [y0, m0, d0] = anchor.split('-').map(Number);
  const cur = new Date(Date.UTC(y0, m0 - 1, 1, 12, 0, 0));
  cur.setUTCMonth(cur.getUTCMonth() + nMonths);
  const y = cur.getUTCFullYear();
  const mo = cur.getUTCMonth();
  const lastDay = new Date(Date.UTC(y, mo + 1, 0, 12, 0, 0)).getUTCDate();
  const day = Math.min(d0, lastDay);
  const mm = String(mo + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

/** Ankordan başlayaraq hər faktura tarixi D üçün D <= untilYmd */
function listBillingDueDatesUpTo(anchorYmd, untilYmdInclusive) {
  const until = parseYmd(untilYmdInclusive);
  const anchor = parseYmd(anchorYmd);
  if (!anchor || !until || anchor > until) return [];
  const out = [];
  for (let i = 0; ; i += 1) {
    const d = addMonthsFromAnchor(anchor, i);
    if (!d || d > until) break;
    out.push(d);
  }
  return out;
}

function paymentYmd(p) {
  return toYmdFromDb(p.payment_date) || toYmdFromDb(p.paid_at) || null;
}

function isInitialBalancePayment(p) {
  const n = p.notes != null ? String(p.notes) : '';
  return n.startsWith('[Başlanğıc balansı]');
}

function periodEndExclusive(dueYmd) {
  return addMonthsFromAnchor(dueYmd, 1);
}

/**
 * Ödəniş bu faktura dövrünü (yarıminterval [dueYmd, nextDue)) bağlayıb?
 * Yeni qeydlər: period sütunu === dueYmd. Köhnə: ödəniş tarixi intervalda.
 */
function paymentCoversBillingDue(p, dueYmd) {
  if (!p || p.status !== 'completed') return false;
  if (isInitialBalancePayment(p)) return false;
  const due = parseYmd(dueYmd);
  if (!due) return false;
  const pe = periodEndExclusive(dueYmd);
  if (!pe) return false;
  const pr = p.period != null && String(p.period).trim() !== '' ? String(p.period).trim().slice(0, 10) : null;
  if (pr && /^\d{4}-\d{2}-\d{2}$/.test(pr) && pr === due) return true;
  const y = paymentYmd(p);
  if (!y) return false;
  return y >= due && y < pe;
}

function countUnpaidBillingPeriods(anchorYmd, todayYmd, payments) {
  const dues = listBillingDueDatesUpTo(anchorYmd, todayYmd);
  if (!dues.length) return 0;
  const arr = Array.isArray(payments) ? payments : [];
  let n = 0;
  for (const d of dues) {
    const covered = arr.some((p) => paymentCoversBillingDue(p, d));
    if (!covered) n += 1;
  }
  return n;
}

/** Ən kiçik ödənilməmiş faktura tarixi və ya null */
function earliestUnpaidBillingDue(anchorYmd, todayYmd, payments) {
  const dues = listBillingDueDatesUpTo(anchorYmd, todayYmd);
  const arr = Array.isArray(payments) ? payments : [];
  for (const d of dues) {
    if (!arr.some((p) => paymentCoversBillingDue(p, d))) return d;
  }
  return null;
}

module.exports = {
  parseYmd,
  toYmdFromDb,
  addMonthsFromAnchor,
  listBillingDueDatesUpTo,
  paymentCoversBillingDue,
  countUnpaidBillingPeriods,
  earliestUnpaidBillingDue,
  periodEndExclusive,
  paymentYmd,
};
