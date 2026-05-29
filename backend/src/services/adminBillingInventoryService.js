const db = require('../utils/db');
const { getSetting } = require('./billingSettingsService');
const { buildInventoryDisplayWithUsage, syncOperatorInventoryFromLive } = require('./operatorInventoryLiveService');

const DEFAULTS = {
  operator_sms_stock_total: 0,
  operator_sms_stock_remaining: 0,
  operator_sms_low_alert: 500,
  operator_storage_mb_total: 0,
  operator_storage_mb_remaining: 0,
  operator_storage_mb_low_alert: 500,
};

async function readNum(key, fallback) {
  const raw = await getSetting(key);
  if (raw == null || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : fallback;
}

async function isKeySet(key) {
  const raw = await getSetting(key);
  return raw != null && String(raw).trim() !== '';
}

async function getOperatorInventorySettings() {
  const [smsTotal, smsRem, smsLow, stTotal, stRem, stLow, hasSmsTotal, hasSmsRem, hasStTotal, hasStRem] =
    await Promise.all([
      readNum('operator_sms_stock_total', DEFAULTS.operator_sms_stock_total),
      readNum('operator_sms_stock_remaining', DEFAULTS.operator_sms_stock_remaining),
      readNum('operator_sms_low_alert', DEFAULTS.operator_sms_low_alert),
      readNum('operator_storage_mb_total', DEFAULTS.operator_storage_mb_total),
      readNum('operator_storage_mb_remaining', DEFAULTS.operator_storage_mb_remaining),
      readNum('operator_storage_mb_low_alert', DEFAULTS.operator_storage_mb_low_alert),
      isKeySet('operator_sms_stock_total'),
      isKeySet('operator_sms_stock_remaining'),
      isKeySet('operator_storage_mb_total'),
      isKeySet('operator_storage_mb_remaining'),
    ]);
  const inventory_configured = hasSmsTotal || hasSmsRem || hasStTotal || hasStRem;
  return {
    operator_sms_stock_total: smsTotal,
    operator_sms_stock_remaining: smsRem,
    operator_sms_low_alert: smsLow,
    operator_storage_mb_total: stTotal,
    operator_storage_mb_remaining: stRem,
    operator_storage_mb_low_alert: stLow,
    inventory_configured,
    has_sms_total: hasSmsTotal,
    has_sms_remaining: hasSmsRem,
    has_storage_total: hasStTotal,
    has_storage_remaining: hasStRem,
    sms_low: inventory_configured && hasSmsRem && smsRem <= smsLow,
    storage_low: inventory_configured && hasStRem && stRem <= stLow,
  };
}

async function getPlatformAllocatedStats() {
  const { rows } = await db.query(
    `SELECT
       COALESCE(SUM(
         (CASE WHEN sp.sms_limit IS NULL THEN 0 ELSE sp.sms_limit END)
         + COALESCE(uc.extra_sms_balance, 0)
       ), 0)::bigint AS sms_allocated_to_instructors,
       COALESCE(SUM(
         COALESCE(
           sp.storage_limit_bytes,
           CASE WHEN sp.storage_gb IS NOT NULL THEN (sp.storage_gb * 1024 * 1024)::bigint ELSE 0 END
         )
         + COALESCE(uc.extra_storage_bytes, 0)
       ), 0)::bigint AS storage_allocated_bytes
     FROM users u
     LEFT JOIN subscriptions s ON s.user_id = u.id
     LEFT JOIN usage_counters uc ON uc.user_id = u.id
     LEFT JOIN subscription_plans sp ON sp.slug = COALESCE(s.plan, 'basic') AND sp.is_active = TRUE
     WHERE u.role = 'instructor' AND u.is_active = TRUE AND u.deleted_at IS NULL`
  );
  const r = rows[0] || {};
  const storage_allocated_bytes = Number(r.storage_allocated_bytes || 0) || 0;
  return {
    sms_allocated_to_instructors: Number(r.sms_allocated_to_instructors || 0) || 0,
    storage_allocated_mb: Math.round(storage_allocated_bytes / (1024 * 1024)),
  };
}

async function getPlatformUsageStats() {
  const { rows: smsRows } = await db.query(
    `SELECT
       COUNT(*) FILTER (
         WHERE to_char(
                 (COALESCE(sl.created_at, sl.sent_at) AT TIME ZONE 'Asia/Baku'),
                 'YYYY-MM'
               ) = to_char((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Baku'), 'YYYY-MM')
       )::int AS cnt_month,
       COUNT(*)::int AS cnt_all
     FROM sms_logs sl
     WHERE COALESCE(LOWER(TRIM(sl.status)), 'sent') NOT LIKE 'failed%'`
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
  let pending = { pending_sms: 0, pending_storage_mb: 0 };
  try {
    const { rows: pendingRows } = await db.query(
      `SELECT
         COALESCE(SUM(sms_quantity) FILTER (WHERE product_type = 'sms'), 0)::int AS pending_sms,
         COALESCE(SUM(storage_mb) FILTER (WHERE product_type = 'storage'), 0)::int AS pending_storage_mb
       FROM billing_payments
       WHERE status = 'pending' AND payment_method = 'cash'`
    );
    pending = pendingRows[0] || pending;
  } catch {
    /* köhnə DB — storage_mb / product_type olmaya bilər */
  }
  return {
    sms_sent_this_month: Number(smsRows[0]?.cnt_month || 0) || 0,
    sms_sent_all_time: Number(smsRows[0]?.cnt_all || 0) || 0,
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
  const [operator, usage, platform_allocated, instructors_near_limit] = await Promise.all([
    getOperatorInventorySettings(),
    getPlatformUsageStats(),
    getPlatformAllocatedStats(),
    getInstructorsNearLimits(20),
  ]);
  const usageMerged = { ...usage, ...platform_allocated };
  const { live, display } = await buildInventoryDisplayWithUsage(operator, usageMerged);

  const smsRem = display.sms_has_balance ? display.sms_remaining : null;
  const stRem =
    display.storage_has_limit && display.storage_remaining_mb != null
      ? display.storage_remaining_mb
      : null;
  const smsLow = smsRem != null && smsRem <= operator.operator_sms_low_alert;
  const stLow = stRem != null && stRem <= operator.operator_storage_mb_low_alert;

  const alerts = [];
  if (!display.sms_has_data && !display.storage_has_data) {
    alerts.push({
      level: 'warning',
      kind: 'inventory_not_configured',
      message:
        'SMS balansı avtomatik oxunmadı. Railway-də SMS_LOGIN/SMS_PASSWORD yoxlayın və ya əl ilə daxil edib saxlayın. Yaddaş üçün PLATFORM_STORAGE_TOTAL_MB (MB) təyin edin.',
    });
  } else if (!display.sms_has_data && display.sms_provider_error) {
    alerts.push({
      level: 'warning',
      kind: 'sms_provider',
      message: `SMS provayder balansı: ${display.sms_provider_error}`,
    });
  }
  if (smsLow) {
    alerts.push({
      level: 'critical',
      kind: 'operator_sms',
      message: `SMS ehtiyatı ${smsRem} ədədə düşüb (hədd: ${operator.operator_sms_low_alert}). Provayderdən SMS sifariş edin.`,
    });
  }
  if (stLow) {
    alerts.push({
      level: 'critical',
      kind: 'operator_storage',
      message: `Yaddaş ehtiyatı ${stRem} MB-a düşüb (hədd: ${operator.operator_storage_mb_low_alert} MB). Hosting artırın.`,
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
    usage: usageMerged,
    live,
    display,
    instructors_near_limit,
    alerts,
  };
}

module.exports = {
  getAdminBillingInventory,
  getOperatorInventorySettings,
  syncOperatorInventoryFromLive,
};
