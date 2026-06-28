/** Fallback plan limits when DB row missing (source of truth: subscription_plans). */
const PLANS = {
  basic: {
    price_azn: 0,
    students: 5,
    documents: 50,
    storage_limit_bytes: 5 * 1024 * 1024,
    storage_mb: null,
    sms_monthly: 5,
    exams_monthly: 2,
    homeworks_monthly: 5,
    live_participants: 5,
  },
  pro: {
    price_azn: 5,
    students: 20,
    documents: 1250,
    storage_limit_bytes: 128 * 1024 * 1024,
    storage_mb: null,
    sms_monthly: 20,
    exams_monthly: 20,
    homeworks_monthly: 40,
    live_participants: 20,
  },
  growth: {
    price_azn: 10,
    students: 50,
    documents: 5000,
    storage_limit_bytes: 512 * 1024 * 1024,
    storage_mb: null,
    sms_monthly: 50,
    exams_monthly: 50,
    homeworks_monthly: 120,
    live_participants: 50,
  },
  premium: {
    price_azn: 19,
    students: null,
    documents: null,
    storage_limit_bytes: null,
    storage_mb: null,
    sms_monthly: 200,
    exams_monthly: null,
    homeworks_monthly: null,
    live_participants: null,
  },
};

function normalizePlanSlug(raw) {
  const s = String(raw || '')
    .trim()
    .toLowerCase();
  if (s === 'premium' || s === 'business' || s === 'biznes') return 'premium';
  if (s === 'growth') return 'growth';
  if (s === 'pro') return 'pro';
  return 'basic';
}

function planRank(raw) {
  const s = normalizePlanSlug(raw);
  if (s === 'premium') return 4;
  if (s === 'growth') return 3;
  if (s === 'pro') return 2;
  return 1;
}

function highestPlanSlug(plansMap) {
  const slugs = Object.keys(plansMap || {}).filter((k) => plansMap[k]?.is_active !== false);
  if (!slugs.length) return 'premium';
  return slugs.reduce((best, slug) => (planRank(slug) > planRank(best) ? slug : best), slugs[0]);
}

module.exports = { PLANS, normalizePlanSlug, planRank, highestPlanSlug };
