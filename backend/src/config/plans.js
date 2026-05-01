const PLANS = {
  basic: {
    price_azn: 15,
    students: 20,
    storage_mb: 1024, // 1 GB
    sms_monthly: 30,
  },
  pro: {
    price_azn: 29,
    students: 100,
    storage_mb: 5120, // 5 GB
    sms_monthly: 200,
  },
  business: {
    price_azn: 49,
    students: null, // unlimited
    storage_mb: 20480, // 20 GB
    sms_monthly: 500,
  },
};

const TRIAL_LIMITS = {
  students: 5,
  storage_mb: 200,
  sms_monthly: 10,
};

function normalizePlanSlug(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'pro') return 'pro';
  if (s === 'business') return 'business';
  return 'basic';
}

module.exports = { PLANS, TRIAL_LIMITS, normalizePlanSlug };

