'use strict';

const { compareYmd, roundMoney } = require('./subscriptionBilling');

const TRAFFIC_LIGHTS = Object.freeze({
  PAID: 'paid',
  DUE_SOON: 'due_soon',
  OVERDUE: 'overdue',
});

function earliestDueYmd(items) {
  const dates = (items || [])
    .map((x) => String(x?.due_ymd || '').slice(0, 10))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();
  return dates[0] || null;
}

/**
 * Müəllim ödəniş lövhəsi: yaşıl / sarı / qırmızı.
 * 🟢 paid — borc yoxdur
 * 🟡 due_soon — gözlənilir və ya yaxınlaşır (vaxtı hələ keçməyib)
 * 🔴 overdue — gecikdirilib / borclu
 */
function classifyPaymentTrafficLight({
  pendingDebt = 0,
  monthlyFee = 0,
  todayYmd,
  dueYmd,
  unpaidPackAmount = 0,
  packOverdue = false,
  monthlyOverdue = false,
} = {}) {
  const debt = roundMoney(Math.max(0, Number(pendingDebt) || 0));
  const packAmt = roundMoney(Math.max(0, Number(unpaidPackAmount) || 0));
  const fee = Number(monthlyFee);
  const amount = roundMoney(debt > 0.005 ? debt : packAmt);
  const due =
    dueYmd && /^\d{4}-\d{2}-\d{2}$/.test(String(dueYmd).slice(0, 10))
      ? String(dueYmd).slice(0, 10)
      : null;

  if (amount <= 0.005) {
    return { status: TRAFFIC_LIGHTS.PAID, amount: 0, due_ymd: due };
  }

  const dateOverdue = !!(due && todayYmd && compareYmd(due, String(todayYmd).slice(0, 10)) < 0);
  const multiPeriodDebt = Number.isFinite(fee) && fee > 0.005 && debt > fee + 0.005;

  if (packOverdue || monthlyOverdue || dateOverdue || multiPeriodDebt) {
    return { status: TRAFFIC_LIGHTS.OVERDUE, amount, due_ymd: due };
  }

  return { status: TRAFFIC_LIGHTS.DUE_SOON, amount, due_ymd: due };
}

function emptyTrafficSummary() {
  return {
    paid: { count: 0, amount: 0 },
    due_soon: { count: 0, amount: 0 },
    overdue: { count: 0, amount: 0 },
  };
}

function attachPaymentTrafficLights(students, { dueConfirmations, packConfirmations, todayYmd } = {}) {
  const duesBy = new Map();
  for (const d of dueConfirmations || []) {
    const id = String(d.enrollment_id || '');
    if (!id) continue;
    if (!duesBy.has(id)) duesBy.set(id, []);
    duesBy.get(id).push(d);
  }
  const packsBy = new Map();
  for (const p of packConfirmations || []) {
    const id = String(p.enrollment_id || '');
    if (!id) continue;
    if (!packsBy.has(id)) packsBy.set(id, []);
    packsBy.get(id).push(p);
  }

  const status_summary = emptyTrafficSummary();
  const out = (students || []).map((s) => {
    const id = String(s.enrollment_id || '');
    const dues = duesBy.get(id) || [];
    const packs = packsBy.get(id) || [];
    const light = classifyPaymentTrafficLight({
      pendingDebt: s.pending_debt,
      monthlyFee: s.monthly_fee,
      todayYmd,
      dueYmd: earliestDueYmd([...dues, ...packs]),
      unpaidPackAmount: packs.reduce((n, p) => n + (Number(p.amount) || 0), 0),
      packOverdue: packs.some((p) => p.overdue),
      monthlyOverdue: dues.some((d) => d.overdue),
    });
    const bucket = status_summary[light.status] || status_summary.paid;
    bucket.count += 1;
    bucket.amount = roundMoney(bucket.amount + light.amount);
    return {
      ...s,
      status_light: light.status,
      status_amount: light.amount,
      due_ymd: light.due_ymd,
    };
  });

  return { students: out, status_summary };
}

module.exports = {
  TRAFFIC_LIGHTS,
  classifyPaymentTrafficLight,
  attachPaymentTrafficLights,
};
