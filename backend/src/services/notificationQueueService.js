const db = require('../utils/db');

/**
 * `notification_queue` = the single email/SMS outbox and delivery log.
 *
 * Status vocabulary (no DB CHECK; enforced here):
 *   legacy rows (enqueueNotification):   pending → sending → sent | retrying | failed | skipped | dry_run
 *   notification emails (template_key):  queued  → sending → sent | queued (retry) | failed | skipped | suppressed | dry_run
 * Notification rows never use 'pending'/'retrying', so an older worker build (code rollback)
 * cannot pick them up. Claiming uses FOR UPDATE SKIP LOCKED, so several replicas never
 * process the same row; a row stuck in 'sending' (crashed worker) is reclaimed after
 * STALE_CLAIM_MINUTES and counts as an attempt.
 */

const STATUS = Object.freeze({
  QUEUED: 'queued',
  PENDING: 'pending',
  RETRYING: 'retrying',
  SENDING: 'sending',
  SENT: 'sent',
  DRY_RUN: 'dry_run',
  FAILED: 'failed',
  SKIPPED: 'skipped',
  SUPPRESSED: 'suppressed',
});

const MAX_RETRIES = 3;
const STALE_CLAIM_MINUTES = 10;

function backoffMinutes(retryCount) {
  // 1m -> 5m -> 15m -> stop
  if (retryCount <= 0) return 1;
  if (retryCount === 1) return 5;
  return 15;
}

function notificationEmailUniqueKey(notificationId) {
  return `email:notification:${notificationId}`;
}

function isNotificationRow(row) {
  return Boolean(row && row.template_key);
}

async function enqueueNotification({
  channel,
  event_type,
  unique_key,
  user_id = null,
  instructor_id = null,
  to_addr,
  subject = null,
  body,
  context = null,
}) {
  const uk = String(unique_key || '').trim();
  if (!uk) throw new Error('unique_key required');
  const ch = String(channel || '').trim().toLowerCase();
  if (ch !== 'sms' && ch !== 'email') throw new Error('channel must be sms|email');
  const ev = String(event_type || '').trim();
  if (!ev) throw new Error('event_type required');
  const to = String(to_addr || '').trim();
  if (!to) throw new Error('to_addr required');
  const b = String(body || '').trim();
  if (!b) throw new Error('body required');

  await db.query(
    `INSERT INTO notification_queue
       (channel, event_type, unique_key, user_id, instructor_id, to_addr, subject, body, context, status, retry_count, next_retry_at)
     VALUES
       ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,'pending',0,NOW())
     ON CONFLICT (unique_key) DO NOTHING`,
    [ch, ev, uk, user_id, instructor_id, to, subject, b, context ? JSON.stringify(context) : null]
  );
}

/** Atomically claims due rows for this worker (safe with several replicas). */
async function claimDue(limit = 50, opts = {}) {
  const q = opts.client || db;
  const lim = Math.min(200, Math.max(1, Number(limit) || 50));
  const { rows } = await q.query(
    `WITH due AS (
       SELECT id
       FROM notification_queue
       WHERE (status IN ('pending', 'retrying', 'queued') AND next_retry_at <= NOW())
          OR (status = 'sending' AND locked_at < NOW() - ($2 || ' minutes')::interval)
       ORDER BY next_retry_at ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     UPDATE notification_queue nq
     SET status = 'sending',
         retry_count = CASE WHEN nq.status = 'sending' THEN nq.retry_count + 1 ELSE nq.retry_count END,
         locked_at = NOW(),
         attempted_at = NOW(),
         updated_at = NOW()
     FROM due
     WHERE nq.id = due.id
     RETURNING nq.*`,
    [lim, String(STALE_CLAIM_MINUTES)],
  );
  return rows || [];
}

/** @deprecated kept for callers of the old API; the worker uses claimDue(). */
async function fetchDue(limit = 50) {
  return claimDue(limit);
}

/**
 * Outcome → queue status + notification email_status (null = leave the notification as is).
 * @param {{ kind: 'sent'|'dry_run'|'retry'|'failed'|'skipped'|'suppressed' }} outcome
 */
function outcomeStatuses(row, outcome) {
  const nextRetry = Number(row?.retry_count || 0) + 1;
  switch (outcome.kind) {
    case 'sent':
      return { queue: STATUS.SENT, notification: 'sent' };
    case 'dry_run':
      return { queue: STATUS.DRY_RUN, notification: 'dry_run' };
    case 'retry':
      if (outcome.transient !== false && nextRetry < MAX_RETRIES) {
        return {
          queue: isNotificationRow(row) ? STATUS.QUEUED : STATUS.RETRYING,
          notification: null,
          retryCount: nextRetry,
          backoff: backoffMinutes(nextRetry - 1),
        };
      }
      return { queue: STATUS.FAILED, notification: 'failed', retryCount: nextRetry };
    case 'failed':
      return { queue: STATUS.FAILED, notification: 'failed', retryCount: nextRetry };
    case 'skipped':
      return { queue: STATUS.SKIPPED, notification: 'skipped' };
    case 'suppressed':
      return { queue: STATUS.SUPPRESSED, notification: null };
    default:
      throw new Error(`unknown outcome: ${outcome.kind}`);
  }
}

/**
 * Writes the delivery result to the queue row and (same statement) to the linked
 * notification's email_status / email_sent_at.
 * @returns {Promise<{ status: string, notificationStatus: string|null }>}
 */
async function recordOutcome(row, outcome, opts = {}) {
  const q = opts.client || db;
  const s = outcomeStatuses(row, outcome);
  const errorCode = outcome.errorCode ? String(outcome.errorCode).slice(0, 60) : null;
  const errorMsg = outcome.errorMessageSafe ? String(outcome.errorMessageSafe).slice(0, 300) : null;
  await q.query(
    `WITH q AS (
       UPDATE notification_queue
       SET status = $2,
           retry_count = COALESCE($3::int, retry_count),
           next_retry_at = CASE WHEN $4::int IS NOT NULL THEN NOW() + ($4::int * INTERVAL '1 minute') ELSE next_retry_at END,
           provider = COALESCE($5, provider),
           provider_message_id = COALESCE($6, provider_message_id),
           sent_at = CASE WHEN $2 = 'sent' THEN NOW() ELSE sent_at END,
           delivered_at = CASE WHEN $2 = 'sent' THEN NOW() ELSE delivered_at END,
           failed_at = CASE WHEN $2 = 'failed' THEN NOW() ELSE failed_at END,
           error_code = CASE WHEN $2 IN ('sent', 'dry_run') THEN NULL ELSE COALESCE($7, error_code) END,
           error_message_safe = CASE WHEN $2 IN ('sent', 'dry_run') THEN NULL ELSE COALESCE($8, error_message_safe) END,
           last_error = CASE WHEN $2 IN ('sent', 'dry_run') THEN last_error ELSE COALESCE($8, $7, last_error) END,
           locked_at = NULL,
           updated_at = NOW()
       WHERE id = $1
       RETURNING notification_id
     )
     UPDATE notifications n
     SET email_status = $9,
         email_sent_at = CASE WHEN $9 = 'sent' THEN NOW() ELSE n.email_sent_at END
     FROM q
     WHERE $9::text IS NOT NULL AND n.id = q.notification_id`,
    [
      row.id,
      s.queue,
      s.retryCount ?? null,
      s.backoff ?? null,
      outcome.provider || null,
      outcome.messageId || null,
      errorCode,
      errorMsg,
      s.notification,
    ],
  );
  return { status: s.queue, notificationStatus: s.notification };
}

async function markSent(id) {
  return recordOutcome({ id, retry_count: 0 }, { kind: 'sent' });
}

async function markFailedOrRetrying(id, retryCount, errMsg) {
  const row = { id, retry_count: Math.max(0, Number(retryCount || 0) - 1) };
  return recordOutcome(row, { kind: 'retry', errorCode: 'send_error', errorMessageSafe: String(errMsg || '').slice(0, 300) });
}

/**
 * Admin ops (Phase E): recent failed email deliveries. No addresses, subjects or bodies.
 * @param {{ sinceHours?: number, limit?: number }} [opts]
 */
async function listFailedEmailDeliveries({ sinceHours = 72, limit = 50 } = {}, opts = {}) {
  const q = opts.client || db;
  const hours = Math.min(24 * 90, Math.max(1, Number(sinceHours) || 72));
  const lim = Math.min(200, Math.max(1, Number(limit) || 50));
  const { rows } = await q.query(
    `SELECT id, notification_id, user_id, event_type, template_key, locale, provider,
            error_code, error_message_safe, retry_count, attempted_at, failed_at, created_at
     FROM notification_queue
     WHERE status = 'failed' AND channel = 'email'
       AND failed_at >= NOW() - ($1 || ' hours')::interval
     ORDER BY failed_at DESC
     LIMIT $2`,
    [String(hours), lim],
  );
  return rows || [];
}

async function failedEmailDeliverySummary({ sinceHours = 24 } = {}, opts = {}) {
  const q = opts.client || db;
  const hours = Math.min(24 * 90, Math.max(1, Number(sinceHours) || 24));
  const { rows } = await q.query(
    `SELECT COALESCE(error_code, 'unknown') AS error_code, COALESCE(template_key, event_type) AS template, COUNT(*)::int AS count
     FROM notification_queue
     WHERE status = 'failed' AND channel = 'email'
       AND failed_at >= NOW() - ($1 || ' hours')::interval
     GROUP BY 1, 2
     ORDER BY count DESC`,
    [String(hours)],
  );
  const total = (rows || []).reduce((acc, r) => acc + Number(r.count || 0), 0);
  return { since_hours: hours, total, groups: rows || [] };
}

/**
 * Digest hook (NOT scheduled yet). Notifications whose email was held for a daily/weekly
 * summary keep `email_status = 'digest'` and `meta.email_frequency`. A future digest job
 * (advisory-locked cron, 09:00 Asia/Baku) should read them here, render one summary email
 * per user, enqueue it with unique_key `email:digest:<frequency>:<user>:<period>` and then
 * set email_status = 'queued' → worker outcome on the included rows.
 */
async function listDigestCandidates({ frequency = 'daily', limit = 500 } = {}, opts = {}) {
  const q = opts.client || db;
  const freq = frequency === 'weekly' ? 'weekly' : 'daily';
  const { rows } = await q.query(
    `SELECT id, user_id, type, category, created_at
     FROM notifications
     WHERE email_status = 'digest' AND meta->>'email_frequency' = $1
     ORDER BY user_id, created_at
     LIMIT $2`,
    [freq, Math.min(5000, Math.max(1, Number(limit) || 500))],
  );
  return rows || [];
}

module.exports = {
  STATUS,
  MAX_RETRIES,
  STALE_CLAIM_MINUTES,
  backoffMinutes,
  notificationEmailUniqueKey,
  isNotificationRow,
  enqueueNotification,
  claimDue,
  fetchDue,
  outcomeStatuses,
  recordOutcome,
  markSent,
  markFailedOrRetrying,
  listFailedEmailDeliveries,
  failedEmailDeliverySummary,
  listDigestCandidates,
};
