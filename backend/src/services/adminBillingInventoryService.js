const db = require('../utils/db');
const { getSetting } = require('./billingSettingsService');

const DEFAULTS = {
  operator_sms_stock_remaining: 0,
  operator_sms_low_alert: 500,
  operator_storage_mb_remaining: 0,
  operator_storage_mb_low_alert: 500,
};

async function readNum(key, fallback) {
  const raw = await getSetting(key);
  if (raw == null || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : fallback;
}

async function getOperatorInventorySettings() {
  const [smsRem, smsLow, stRem, stLow] = await Promise.all([
    readNum('operator_sms_stock_remaining', DEFAULTS.operator_sms_stock_remaining),
    readNum('operator_sms_low_alert', DEFAULTS.operator_sms_low_alert),
    readNum('operator_storage_mb_remaining', DEFAULTS.operator_storage_mb_remaining),
    readNum('operator_storage_mb_low_alert', DEFAULTS.operator_storage_mb_low_alert),
  ]);
  return {
    operator_sms_stock_remaining: smsRem,
    operator_sms_low_alert: smsLow,
    operator_storage_mb_remaining: stRem,
    operator_storage_mb_low_alert: stLow,
    sms_low: smsRem <= smsLow,
    storage_low: stRem <= stLow,
  };
}

async function getPlatformUsageStats() {
  const { rows: smsRows } = await db.query(
    `SELECT COUNT(*)::int AS cnt
     FROM sms_logs sl
     WHERE to_char(
             (COALESCE(sl.created_at, sl.sent_at) AT TIME ZONE 'Asia/Baku'),
             'YYYY-MM'
           ) = to_char((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Baku'), 'YYYY-MM')
       AND COALESCE(LOWER(TRIM(sl.status)), 'sent') NOT LIKE 'failed%'`
  );
  const { rows: ucRows } = await db.query(
    `SELECT
       COALESCE(SUM(COALESCE(uc.sms_used_monthly, 0)), 0)::bigint AS sms_used_counters,
       COALESCE(SUM(COALESCE(uc.extra_sms_balance, 0)), 0)::bigint AS extra_sms_total,
       COALESCE(SUM(COALESCE(uc.extra_storage_bytes, 0)), 0)::bigint AS extra_storage_bytes_total,
       COALESCE(SUM(COALESCE(uc.storage_used_bytes, 0)), 0)::bigint AS storage_used_bytes_total
     FROM usage_counters uc
     JOIN users u ON u.id = uc.user_id AND u.role = 'instructor' AND u.deleted_at IS NULL`
  );
  const uc = ucRows[0] || {};
  const { rows: pendingRows } = await db.query(
    `SELECT
       COALESCE(SUM(sms_quantity) FILTER (WHERE product_type = 'sms'), 0)::int AS pending_sms,
       COALESCE(SUM(storage_mb) FILTER (WHERE product_type = 'storage'), 0)::int AS pending_storage_mb
     FROM billing_payments
     WHERE status = 'pending' AND payment_method = 'cash'`
  );
  const pending = pendingRows[0] || {};
  return {
    sms_sent_this_month: Number(smsRows[0]?.cnt || 0) || 0,
    sms_used_counters: Number(uc.sms_used_counters || 0) || 0,
    extra_sms_sold_total: Number(uc.extra_sms_total || 0) || 0,
    storage_used_mb: Math.round((Number(uc.storage_used_bytes_total || 0) || 0) / (1024 * 1024)),
    extra_storage_sold_mb: Math.round(
      (Number(uc.extra_storage_bytes_total || 0) || 0) / (1024 * 1024)
    ),
    pending_sms_topup: Number(pending.pending_sms || 0) || 0,
    pending_storage_topup_mb: Number(pending.pending_storage_mb || 0) || 0,
  };
}

async function getInstructorsNearLimits(limit = 15) {
  const { rows } = await db.query(
    `SELECT
       u.id,
       u.full_name,
       u.email,
       COALESCE(s.plan, 'basic') AS plan,
       GREATEST(COALESCE(uc.sms_used_monthly, 0), 0)::int AS sms_used,
       (COALESCE(sp.sms_limit, 0) + COALESCE(uc.extra_sms_balance, 0))::int AS sms_cap,
       COALESCE(uc.storage_used_bytes, 0)::bigint AS storage_used_bytes,
       (
         COALESCE(
           sp.storage_limit_bytes,
           CASE WHEN sp.storage_gb IS NOT NULL THEN (sp.storage_gb * 1024 * 1024)::bigint ELSE NULL END
         )
         + COALESCE(uc.extra_storage_bytes, 0)
       )::bigint AS storage_cap_bytes
     FROM users u
     LEFT JOIN subscriptions s ON s.user_id = u.id
     LEFT JOIN usage_counters uc ON uc.user_id = u.id
     LEFT JOIN subscription_plans sp ON sp.slug = COALESCE(s.plan, 'basic') AND sp.is_active = TRUE
     WHERE u.role = 'instructor' AND u.is_active = TRUE AND u.deleted_at IS NULL
     ORDER BY u.full_name
     LIMIT 500`,
    []
  );
  const out = [];
  for (const r of rows || []) {
    const smsCap = r.sms_cap != null ? Number(r.sms_cap) : null;
    const smsUsed = Number(r.sms_used) || 0;
    const stCap = r.storage_cap_bytes != null ? Number(r.storage_cap_bytes) : null;
    const stUsed = Number(r.storage_used_bytes) || 0;
    const smsPct = smsCap != null && smsCap > 0 ? Math.round((smsUsed / smsCap) * 100) : null;
    const stPct = stCap != null && stCap > 0 ? Math.round((stUsed / stCap) * 100) : null;
    const smsRisk = smsPct != null && smsPct >= 80;
    const stRisk = stPct != null && stPct >= 80;
    if (!smsRisk && !stRisk) continue;
    out.push({
      id: r.id,
      full_name: r.full_name,
      email: r.email,
      plan: r.plan,
      sms_used: smsUsed,
      sms_cap: smsCap,
      sms_pct: smsPct,
      storage_used_mb: Math.round(stUsed / (1024 * 1024)),
      storage_cap_mb: stCap != null ? Math.round(stCap / (1024 * 1024)) : null,
      storage_pct: stPct,
    });
    if (out.length >= limit) break;
  }
  out.sort((a, b) => Math.max(b.sms_pct || 0, b.storage_pct || 0) - Math.max(a.sms_pct || 0, a.storage_pct || 0));
  return out;
}

async function getAdminBillingInventory() {
  const [operator, usage, instructors_near_limit] = await Promise.all([
    getOperatorInventorySettings(),
    getPlatformUsageStats(),
    getInstructorsNearLimits(20),
  ]);
  const alerts = [];
  if (operator.sms_low) {
    alerts.push({
      level: 'critical',
      kind: 'operator_sms',
      message: `SMS ehtiyatınız ${operator.operator_sms_stock_remaining} ədədə düşüb (hədd: ${operator.operator_sms_low_alert}). Provayderdən SMS sifariş edin.`,
    });
  }
  if (operator.storage_low) {
    alerts.push({
      level: 'critical',
      kind: 'operator_storage',
      message: `Yaddaş ehtiyatınız ${operator.operator_storage_mb_remaining} MB-a düşüb (hədd: ${operator.operator_storage_mb_low_alert} MB). Hosting/yaddaş artırın.`,
    });
  }
  if (instructors_near_limit.length >= 5) {
    alerts.push({
      level: 'warning',
      kind: 'instructors_limits',
      message: `${instructors_near_limit.length}+ müəllimin SMS və ya yaddaş limitinə yaxınlaşır. Top-up satışları arta bilər.`,
    });
  }
  return {
    operator,
    usage,
    instructors_near_limit,
    alerts,
  };
}

module.exports = {
  getAdminBillingInventory,
  getOperatorInventorySettings,
};
