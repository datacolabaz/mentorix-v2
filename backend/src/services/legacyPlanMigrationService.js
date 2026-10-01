/**
 * Legacy 5 AZN STANDART ('pro') -> PROFESSIONAL ('growth', 10 AZN) at the NEXT renewal.
 *
 * Billing is manual: a teacher starts a card checkout or a cash/receipt payment that an admin approves.
 * There is no recurring charge, so "moving" a subscriber means: after the advance notice, a renewal of
 * the legacy plan is refused and the teacher renews on PROFESSIONAL. The current paid period is never
 * shortened or re-priced, and nothing is charged without the teacher starting a payment.
 *
 * Lead time: the notice (email + in-app, mandatory billing notice) goes out 14–15 days before the
 * current period ends (daily job, window opens at 15 days). If a subscriber's period ends sooner than
 * 14 days after the first notice (e.g. right after deploy, or already past due), one more 5 AZN
 * monthly renewal is allowed; after it a fresh 14-day notice is sent for the following renewal.
 */
const db = require('../utils/db');
const { normalizePlanSlug } = require('../config/plans');

const LEGACY_PLAN = 'pro';
const TARGET_PLAN = 'growth';
const LEAD_DAYS = 14;
const WINDOW_DAYS = 15;
const DAY_MS = 86400000;

function bakuDate(value) {
  const t = new Date(value).getTime();
  if (!Number.isFinite(t)) return '';
  const d = new Date(t + 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [y, m, dd] = d.split('-');
  return `${dd}.${m}.${y}`;
}

/**
 * Pure decision for one legacy subscription.
 * @returns {{ due: boolean, proRenewalsLeft?: number, effectiveAt?: Date|null, daysLeft?: number }}
 */
function noticeDecision({ periodEnd, now = new Date() }) {
  const nowMs = new Date(now).getTime();
  if (!periodEnd) {
    return { due: true, proRenewalsLeft: 0, effectiveAt: new Date(nowMs + LEAD_DAYS * DAY_MS), daysLeft: LEAD_DAYS };
  }
  const endMs = new Date(periodEnd).getTime();
  const remainingMs = endMs - nowMs;
  if (remainingMs > WINDOW_DAYS * DAY_MS) return { due: false };
  const fullLead = remainingMs >= LEAD_DAYS * DAY_MS;
  return {
    due: true,
    proRenewalsLeft: fullLead ? 0 : 1,
    effectiveAt: new Date(endMs),
    daysLeft: Math.max(0, Math.floor(remainingMs / DAY_MS)),
  };
}

function noticeParams(decision, periodEnd) {
  const params = {
    oldPlan: 'STANDART',
    oldPrice: '5 AZN',
    newPlan: 'PROFESSIONAL',
    newPrice: '10 AZN',
    periodEnd: periodEnd ? bakuDate(periodEnd) : '',
  };
  if (decision.proRenewalsLeft > 0) params.daysLeft = String(decision.daysLeft);
  else params.effectiveDate = decision.effectiveAt ? bakuDate(decision.effectiveAt) : '';
  return params;
}

async function getMigrationRow(conn, userId) {
  try {
    const { rows } = await conn.query(
      `SELECT user_id, notice_sent_at, effective_at, pro_renewals_left, applied_at, period_end_at_notice
       FROM legacy_plan_migrations WHERE user_id = $1`,
      [userId],
    );
    return rows[0] || null;
  } catch (e) {
    if (e?.code === '42P01') return null;
    throw e;
  }
}

/**
 * Checkout guard for a renewal of the legacy plan. Throws with a stable code; returns nothing on success.
 */
async function assertLegacyRenewalAllowed(conn, { userId, subscriptionStatus, billingInterval }) {
  const status = String(subscriptionStatus || '').toLowerCase();
  if (status && !['active', 'past_due'].includes(status)) {
    const err = new Error('Bu paket artıq yeni abunəlik üçün təklif olunmur. PROFESSIONAL (10 AZN/ay) seçin.');
    err.code = 'PLAN_NOT_AVAILABLE';
    err.statusCode = 400;
    throw err;
  }
  if (billingInterval === 'yearly') {
    const err = new Error('STANDART paketi yalnız aylıq yenilənir. İllik ödəniş üçün PROFESSIONAL seçin.');
    err.code = 'LEGACY_PLAN_MONTHLY_ONLY';
    err.statusCode = 400;
    throw err;
  }
  const row = await getMigrationRow(conn, userId);
  if (row && !row.applied_at && row.notice_sent_at && Number(row.pro_renewals_left) <= 0) {
    const err = new Error(
      'STANDART paketi (5 AZN) artıq yenilənmir — əvvəlcədən bildirildiyi kimi növbəti dövr üçün PROFESSIONAL (10 AZN/ay) seçin.',
    );
    err.code = 'LEGACY_PLAN_MIGRATED';
    err.statusCode = 409;
    err.targetPlan = TARGET_PLAN;
    throw err;
  }
}

/**
 * Called after a plan payment is activated (inside the activation transaction, best-effort via SAVEPOINT).
 * - legacy renewal used the one extra renewal -> reset so a fresh 14-day notice precedes the next one
 * - any other plan -> migration done
 */
async function onPlanActivated(client, { userId, newPlan }) {
  const plan = normalizePlanSlug(newPlan);
  await client.query('SAVEPOINT legacy_plan_migration');
  try {
    if (plan === LEGACY_PLAN) {
      await client.query(
        `UPDATE legacy_plan_migrations
         SET pro_renewals_left = 0, notice_sent_at = NULL, effective_at = NULL, period_end_at_notice = NULL,
             updated_at = NOW()
         WHERE user_id = $1 AND applied_at IS NULL AND pro_renewals_left > 0`,
        [userId],
      );
    } else {
      await client.query(
        `UPDATE legacy_plan_migrations SET applied_at = NOW(), updated_at = NOW()
         WHERE user_id = $1 AND applied_at IS NULL`,
        [userId],
      );
    }
    await client.query('RELEASE SAVEPOINT legacy_plan_migration');
  } catch (e) {
    await client.query('ROLLBACK TO SAVEPOINT legacy_plan_migration').catch(() => {});
    if (e?.code !== '42P01') console.error('[legacy-plan] onPlanActivated', e?.message || e);
  }
}

/** Daily job: send the advance notice to legacy subscribers whose renewal is within the window. */
async function runLegacyPlanMigrationNotices({ now = new Date() } = {}) {
  const { createNotificationSafe } = require('./notificationService');
  let rows;
  try {
    ({ rows } = await db.query(
      `SELECT s.user_id, s.current_period_end
       FROM subscriptions s
       JOIN users u ON u.id = s.user_id AND u.deleted_at IS NULL
       LEFT JOIN legacy_plan_migrations m ON m.user_id = s.user_id
       WHERE LOWER(s.plan) = $1
         AND s.status IN ('active', 'past_due')
         AND (m.user_id IS NULL OR (m.notice_sent_at IS NULL AND m.applied_at IS NULL))
         AND (s.current_period_end IS NULL OR s.current_period_end <= $2::timestamptz + interval '${WINDOW_DAYS} days')`,
      [LEGACY_PLAN, new Date(now).toISOString()],
    ));
  } catch (e) {
    if (e?.code === '42P01') return { checked: 0, notified: 0, skipped: 'migration_pending' };
    throw e;
  }
  const stats = { checked: rows.length, notified: 0, extraRenewal: 0 };
  for (const r of rows) {
    const decision = noticeDecision({ periodEnd: r.current_period_end, now });
    if (!decision.due) continue;
    const periodKey = r.current_period_end ? new Date(r.current_period_end).toISOString().slice(0, 10) : 'none';
    try {
      // eslint-disable-next-line no-await-in-loop
      const out = await createNotificationSafe({
        recipientId: r.user_id,
        category: 'billing',
        eventType: 'legacy_plan_migration_notice',
        priority: 'HIGH',
        params: noticeParams(decision, r.current_period_end),
        meta: { href: '/instructor/settings#billing-plans' },
        providerWorkspaceId: r.user_id,
        dedupeKey: `legacy_plan_migration_notice:${r.user_id}:${periodKey}`,
        email: true,
      });
      if (!out?.created && !out?.deduped) continue;
      // eslint-disable-next-line no-await-in-loop
      await db.query(
        `INSERT INTO legacy_plan_migrations
           (user_id, from_plan, to_plan, period_end_at_notice, notice_sent_at, effective_at, pro_renewals_left)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (user_id) DO UPDATE
           SET period_end_at_notice = EXCLUDED.period_end_at_notice,
               notice_sent_at = EXCLUDED.notice_sent_at,
               effective_at = EXCLUDED.effective_at,
               pro_renewals_left = EXCLUDED.pro_renewals_left,
               updated_at = NOW()
           WHERE legacy_plan_migrations.applied_at IS NULL`,
        [
          r.user_id,
          LEGACY_PLAN,
          TARGET_PLAN,
          r.current_period_end || null,
          new Date(now).toISOString(),
          decision.effectiveAt ? decision.effectiveAt.toISOString() : null,
          decision.proRenewalsLeft,
        ],
      );
      stats.notified += 1;
      if (decision.proRenewalsLeft > 0) stats.extraRenewal += 1;
    } catch (e) {
      console.error('[legacy-plan] notice', String(r.user_id).slice(0, 8), e?.message || e);
    }
  }
  return stats;
}

/** Shape for GET /api/billing/status (null when the teacher is not affected). */
async function legacyMigrationStatus(conn, userId) {
  const row = await getMigrationRow(conn, userId);
  if (!row || row.applied_at) return null;
  return {
    to_plan: TARGET_PLAN,
    notice_sent_at: row.notice_sent_at || null,
    effective_at: row.effective_at || null,
    pro_renewals_left: Number(row.pro_renewals_left) || 0,
    renewal_blocked: Boolean(row.notice_sent_at) && Number(row.pro_renewals_left) <= 0,
  };
}

module.exports = {
  LEGACY_PLAN,
  TARGET_PLAN,
  LEAD_DAYS,
  WINDOW_DAYS,
  bakuDate,
  noticeDecision,
  noticeParams,
  assertLegacyRenewalAllowed,
  onPlanActivated,
  runLegacyPlanMigrationNotices,
  legacyMigrationStatus,
};
