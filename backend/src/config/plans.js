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
    recording_hours_monthly: 0,
    recording_storage_bytes: 0,
    recording_retention_days: 0,
    recording_max_duration_sec: 0,
    recording_max_quality: null,
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
    recording_hours_monthly: 5,
    recording_storage_bytes: 5 * 1024 * 1024 * 1024,
    recording_retention_days: 30,
    recording_max_duration_sec: 7200,
    recording_max_quality: '720p',
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
    recording_hours_monthly: 20,
    recording_storage_bytes: 20 * 1024 * 1024 * 1024,
    recording_retention_days: 90,
    recording_max_duration_sec: 7200,
    recording_max_quality: '720p',
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
    recording_hours_monthly: 50,
    recording_storage_bytes: 50 * 1024 * 1024 * 1024,
    recording_retention_days: 180,
    recording_max_duration_sec: 10800,
    recording_max_quality: '1080p',
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
