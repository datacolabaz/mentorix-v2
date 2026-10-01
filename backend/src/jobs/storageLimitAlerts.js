/**
 * Cloud storage 80% / 100% alerts for teachers (dashboard notification + email, category "billing").
 * At most one alert per level per limit per calendar month (dedupe key), so replicas/re-runs are safe.
 * Reaching the limit only blocks new uploads; existing files are never deleted.
 */
const db = require('../utils/db');
const { resolveEntitlements } = require('../services/billingEntitlements');
const { createNotificationSafe } = require('../services/notificationService');
const { TOP_PLAN_SLUG, supportPhoneDisplay } = require('../lib/storageLimitCopy');

const WARN_RATIO = 0.8;

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(n >= 10 * 1024 ** 3 ? 0 : 1)} GB`;
  if (n >= 1024 ** 2) return `${Math.round(n / 1024 ** 2)} MB`;
  return `${Math.max(0, Math.round(n / 1024))} KB`;
}

/** 'reached' | 'warning' | null */
function storageAlertLevel(usedBytes, limitBytes) {
  const used = Number(usedBytes) || 0;
  const cap = Number(limitBytes) || 0;
  if (!cap || cap <= 0) return null;
  if (used >= cap) return 'reached';
  if (used >= cap * WARN_RATIO) return 'warning';
  return null;
}

/** Premium (50 GB) is the top plan: no upgrade hint, only "delete old files or contact support". */
function storageReachedExtras(planSlug, supportPhone) {
  const slug = String(planSlug || '').toLowerCase();
  return {
    supportPhone: supportPhone || '',
    nextPlan: slug === TOP_PLAN_SLUG ? '' : 'PREMIUM (50 GB)',
  };
}

function bakuMonth(now = new Date()) {
  return new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString().slice(0, 7);
}

async function runStorageLimitAlerts({ now = new Date() } = {}) {
  const { rows } = await db.query(
    `SELECT uc.user_id
     FROM usage_counters uc
     JOIN users u ON u.id = uc.user_id AND u.role = 'instructor' AND u.is_active = TRUE AND u.deleted_at IS NULL
     WHERE COALESCE(uc.storage_used_bytes, 0) > 0`,
  );
  const month = bakuMonth(now);
  const stats = { checked: rows.length, warning: 0, reached: 0 };
  const supportPhone = rows.length ? await supportPhoneDisplay() : '';
  for (const r of rows) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const ent = await resolveEntitlements(r.user_id);
      const cap = ent?.limits?.storage_limit_bytes;
      const used = ent?.usage?.storage_bytes;
      const level = storageAlertLevel(used, cap);
      if (!level) continue;
      const eventType = level === 'reached' ? 'storage_limit_reached' : 'storage_limit_warning';
      // eslint-disable-next-line no-await-in-loop
      const out = await createNotificationSafe({
        recipientId: r.user_id,
        category: 'billing',
        eventType,
        priority: level === 'reached' ? 'HIGH' : 'NORMAL',
        params: {
          percent: String(Math.min(100, Math.floor((Number(used) / Number(cap)) * 100))),
          used: formatBytes(used),
          limit: formatBytes(cap),
          ...(level === 'reached' ? storageReachedExtras(ent?.plan, supportPhone) : {}),
        },
        meta: { href: '/instructor/settings#billing-plans' },
        providerWorkspaceId: r.user_id,
        dedupeKey: `${eventType}:${cap}:${month}`,
        email: true,
      });
      if (out?.created) stats[level] += 1;
    } catch (e) {
      console.error('[storage-alerts]', String(r.user_id).slice(0, 8), e?.message || e);
    }
  }
  return stats;
}

module.exports = { runStorageLimitAlerts, storageAlertLevel, storageReachedExtras, formatBytes };
