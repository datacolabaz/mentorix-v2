const PLANS = {
  basic: {
    price_azn: 0,
    students: 5,
    storage_limit_bytes: 512 * 1024,
    storage_mb: null,
    sms_monthly: 5,
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

function normalizePlanSlug(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'pro') return 'pro';
  if (s === 'business') return 'business';
  return 'basic';
}

module.exports = { PLANS, normalizePlanSlug };

