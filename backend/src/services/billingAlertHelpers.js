const { normalizePlanSlug, planRank, highestPlanSlug } = require('../config/plans');

function isHighestTierPlan(planSlug, plansMap) {
  return planRank(planSlug) >= planRank(highestPlanSlug(plansMap));
}

/** (used / effectiveLimit) — effectiveLimit = cari paket + əlavə SMS balansı */
function usageRatio(used, effectiveLimit) {
  const u = Math.max(0, Number(used) || 0);
  if (effectiveLimit == null) return { pct: 0, used: u, limit: null };
  const l = Math.max(0, Number(effectiveLimit) || 0);
  if (l <= 0) return { pct: u > 0 ? 100 : 0, used: u, limit: l };
  return { pct: Math.round((u / l) * 100), used: u, limit: l };
}

function smsUsageLine(used, limits) {
  const effective = limits?.sms_monthly;
  const { pct, used: u, limit: l } = usageRatio(used, effective);
  if (l == null) return null;
  const displayPct = u >= l ? 100 : Math.min(pct, 100);
  return {
    pct,
    displayPct,
    label: `${u}/${l}`,
    message: `SMS limitiniz ${displayPct}% dolub (${u}/${l})`,
    warnMessage: `SMS limitinə yaxınlasırsınız (${u}/${l})`,
  };
}

function storageUsageLine(used, limits) {
  const cap = limits?.storage_limit_bytes;
  const usedBytes = Number(used?.storage_bytes ?? 0) || 0;
  if (cap != null && Number(cap) > 0) {
    const capN = Number(cap);
    const pct = Math.round((usedBytes / capN) * 100);
    const displayPct = usedBytes >= capN ? 100 : Math.min(pct, 100);
    return {
      pct,
      displayPct,
      message: `Yaddaş limitiniz ${displayPct}% dolub`,
      warnMessage: `Yaddaş limitinə yaxınlasırsınız`,
      bytes: true,
    };
  }
  const stLimMb = limits?.storage_mb;
  const stUsedMb = Number(used?.storage_mb || 0) || 0;
  if (stLimMb == null) return null;
  const { pct, used: usedMb, limit: limMb } = usageRatio(stUsedMb, stLimMb);
  const displayPct = usedMb >= limMb ? 100 : Math.min(pct, 100);
  return {
    pct,
    displayPct,
    message: `Yaddaş limitiniz ${displayPct}% dolub (${usedMb}/${limMb} MB)`,
    warnMessage: `Yaddaş limitinə yaxınlasırsınız (${usedMb}/${limMb} MB)`,
    bytes: false,
  };
}

async function fetchPendingTopups(dbConn, userId) {
  const { rows } = await dbConn.query(
    `SELECT product_type, plan, sms_quantity, storage_mb, amount_cents, created_at
     FROM billing_payments
     WHERE user_id = $1::uuid
       AND status = 'pending'
       AND payment_method = 'cash'
     ORDER BY created_at DESC
     LIMIT 10`,
    [userId]
  );
  const list = rows || [];
  const hasPendingSms = list.some((r) => String(r.product_type || '') === 'sms');
  const hasPendingPlan = list.some((r) => String(r.product_type || '') === 'plan');
  const pending_sms_quantity = list.reduce((sum, r) => {
    if (String(r.product_type || '') !== 'sms') return sum;
    return sum + Math.max(0, Math.round(Number(r.sms_quantity) || 0));
  }, 0);
  const pendingPlanRow = list.find((r) => String(r.product_type || '') === 'plan');
  const pending_plan_slug = pendingPlanRow?.plan
    ? normalizePlanSlug(pendingPlanRow.plan)
    : null;
  const hasPendingStorage = list.some((r) => String(r.product_type || '') === 'storage');
  const pending_storage_mb = list.reduce((sum, r) => {
    if (String(r.product_type || '') !== 'storage') return sum;
    return sum + Math.max(0, Math.round(Number(r.storage_mb) || 0));
  }, 0);
  return {
    hasPendingAny: list.length > 0,
    hasPendingSms,
    hasPendingPlan,
    hasPendingStorage,
    pending_sms_quantity,
    pending_storage_mb,
    pending_plan_slug,
    items: list,
  };
}

function pickLimitCta({ plan, plansMap, reachedSms, reachedStorage, reachedStudents }) {
  const planSlug = normalizePlanSlug(plan);
  const onBasic = planSlug === 'basic';
  const highest = isHighestTierPlan(plan, plansMap);
  if (reachedStudents) {
    return { label: 'Paketlərə bax', action: 'OPEN_SETTINGS_PLANS' };
  }
  if (reachedSms && highest && !onBasic) {
    return { label: 'SMS Balansı Artır', action: 'OPEN_SMS_TOPUP' };
  }
  if (reachedStorage && highest && !onBasic) {
    return { label: 'Yaddaş al', action: 'OPEN_STORAGE_TOPUP' };
  }
  if (reachedSms || reachedStorage) {
    return { label: 'Paketlərə bax', action: 'OPEN_SETTINGS_PLANS' };
  }
  return { label: 'Paketlərə bax', action: 'OPEN_SETTINGS_PLANS' };
}

module.exports = {
  planRank,
  highestPlanSlug,
  isHighestTierPlan,
  usageRatio,
  smsUsageLine,
  storageUsageLine,
  fetchPendingTopups,
  pickLimitCta,
};
