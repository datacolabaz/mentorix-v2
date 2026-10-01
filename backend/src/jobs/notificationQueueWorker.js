const db = require('../utils/db');
const policy = require('../config/notificationPolicy');
const { claimDue, recordOutcome, MAX_RETRIES, isNotificationRow } = require('../services/notificationQueueService');
const { userEmail } = require('../services/emailService');
const { unsubscribeUrl } = require('../services/emailUnsubscribe');
const { sendMail, safeMessage } = require('../services/email/emailTransport');
const { renderEmail, notificationTemplateKey, emailLocale, GENERIC_NOTIFICATION_KEY } = require('../services/email/emailTemplates');
const { appLink } = require('../services/email/emailConfig');
const { resolveNotificationLink } = require('../services/notificationLinkResolver');
const { emitNotificationEvent, NOTIFICATION_EVENTS } = require('../services/notificationEvents');
const { formatDateTime } = require('../utils/formatDateTime');
const { getBrand } = require('../config/brand');

const shortId = (id) => String(id || '').slice(0, 8);

function parseMeta(meta) {
  if (!meta) return {};
  if (typeof meta === 'object') return meta;
  try {
    return JSON.parse(meta);
  } catch {
    return {};
  }
}

function fromSendResult(r) {
  if (r.status === 'sent') return { kind: 'sent', provider: r.provider, messageId: r.messageId };
  if (r.status === 'dry_run') return { kind: 'dry_run', provider: 'dry_run' };
  if (r.status === 'skipped') {
    return { kind: 'skipped', errorCode: r.errorCode || 'provider_unavailable', errorMessageSafe: r.error };
  }
  return {
    kind: r.transient === false ? 'failed' : 'retry',
    transient: r.transient !== false,
    provider: r.provider,
    errorCode: r.errorCode || 'send_error',
    errorMessageSafe: safeMessage(r.error),
  };
}

async function loadNotificationForEmail(notificationId) {
  const { rows } = await db.query(
    `SELECT n.id, n.user_id, n.type, n.category, n.title, n.body, n.meta, n.email_status, n.created_at,
            n.related_entity_type, n.related_entity_id,
            u.email, u.role, u.locale, u.is_active, u.deleted_at
     FROM notifications n
     JOIN users u ON u.id = n.user_id
     WHERE n.id = $1
     LIMIT 1`,
    [notificationId],
  );
  return rows[0] || null;
}

async function loadEmailPrefs(userId, category) {
  const { rows } = await db.query(
    `SELECT category, event_type, channel, enabled, frequency
     FROM notification_preferences
     WHERE user_id = $1 AND category = $2 AND channel = 'email'`,
    [userId, category],
  );
  return rows || [];
}

/** notificationService email (template_key set). Never sends rows that are not 'queued'. */
async function processNotificationEmail(row) {
  if (!row.notification_id) return { kind: 'skipped', errorCode: 'entity_gone' };
  const n = await loadNotificationForEmail(row.notification_id);
  if (!n) return { kind: 'skipped', errorCode: 'entity_gone' };
  if (n.email_status !== 'queued') {
    return { kind: 'suppressed', errorCode: `status_${String(n.email_status || 'none').slice(0, 20)}` };
  }
  if (n.is_active === false || n.deleted_at || !n.email) {
    return { kind: 'skipped', errorCode: 'recipient_unavailable' };
  }

  const eventType = String(n.type || '');
  const mandatory = policy.isMandatory({ category: n.category, eventType });
  if (!mandatory) {
    const decision = policy.resolveDelivery({
      role: n.role,
      category: n.category,
      eventType,
      prefs: await loadEmailPrefs(n.user_id, n.category),
      wantsEmail: true,
    });
    if (!decision.email.eligible || decision.email.frequency !== 'immediate') {
      return { kind: 'skipped', errorCode: 'preference_changed' };
    }
  }

  const link = await resolveNotificationLink(n, { id: n.user_id, role: n.role });
  if (link.status === 'not_found') return { kind: 'skipped', errorCode: 'entity_gone' };
  if (link.status === 'forbidden') return { kind: 'skipped', errorCode: 'access_revoked' };

  const locale = emailLocale(row.locale || n.locale);
  const key = notificationTemplateKey(eventType);
  const meta = parseMeta(n.meta);
  const params =
    key === GENERIC_NOTIFICATION_KEY
      ? { title: n.title, body: n.body }
      : { ...(meta.i18n && typeof meta.i18n.params === 'object' ? meta.i18n.params : {}) };
  params.when = formatDateTime(n.created_at, locale);

  const email = renderEmail(key, locale, params, {
    ctaUrl: appLink(`/notifications?open=${n.id}`),
    unsubscribeUrl: mandatory ? null : unsubscribeUrl(n.user_id, n.category),
  });
  const r = await sendMail(
    {
      stream: 'notification',
      to: n.email,
      subject: email.subject,
      text: email.text,
      html: email.html,
      templateKey: key,
      locale,
    },
    { idempotencyKey: row.unique_key, ref: shortId(row.id) },
  );
  if (r.status === 'skipped') {
    // Notification sending is live but no provider can deliver: an ops problem, keep it visible.
    return { kind: 'failed', transient: false, errorCode: r.errorCode || 'provider_unavailable', errorMessageSafe: r.error };
  }
  return fromSendResult(r);
}

/** Old queue rows (rendered subject/body stored by the caller). */
async function processLegacyEmail(row) {
  let to = row.to_addr;
  if (to === '__resolve__') to = row.user_id ? await userEmail(row.user_id) : null;
  if (!to) return { kind: 'failed', transient: false, errorCode: 'missing_recipient', errorMessageSafe: 'Missing recipient email' };
  const r = await sendMail(
    {
      stream: 'legacy_smtp',
      to,
      subject: row.subject || getBrand().name,
      text: row.body || '',
      templateKey: row.event_type,
    },
    { idempotencyKey: row.unique_key, ref: shortId(row.id) },
  );
  if (r.status === 'skipped') {
    return { kind: 'skipped', errorCode: 'provider_unavailable', errorMessageSafe: 'SMTP disabled' };
  }
  return fromSendResult(r);
}

/** SMS is retired: old queued rows are closed without any provider call (history stays). */
function processSms() {
  return { kind: 'skipped', errorCode: 'sms_retired', errorMessageSafe: 'SMS channel retired' };
}

async function processRow(row) {
  if (Number(row.retry_count || 0) >= MAX_RETRIES) {
    return { kind: 'failed', transient: false, errorCode: 'max_attempts', errorMessageSafe: 'Too many attempts' };
  }
  if (row.channel === 'email') {
    return isNotificationRow(row) ? processNotificationEmail(row) : processLegacyEmail(row);
  }
  if (row.channel === 'sms') return processSms(row);
  return { kind: 'failed', transient: false, errorCode: 'unknown_channel', errorMessageSafe: 'Unknown channel' };
}

function logOutcome(row, outcome, status) {
  if (status === 'sent' || status === 'failed' || status === 'skipped') {
    console.log(
      `[notify-queue] ${status} queue=${shortId(row.id)} channel=${row.channel} template=${row.template_key || row.event_type}${
        outcome.errorCode ? ` code=${outcome.errorCode}` : ''
      }${outcome.provider ? ` provider=${outcome.provider}` : ''}`,
    );
  }
}

async function runNotificationQueueOnce({ limit = 60 } = {}) {
  const rows = await claimDue(limit);
  const counts = {};
  for (const row of rows) {
    let outcome;
    try {
      outcome = await processRow(row);
    } catch (e) {
      outcome = { kind: 'retry', errorCode: 'worker_error', errorMessageSafe: safeMessage(e?.message || 'Queue send error') };
    }
    let recorded;
    try {
      recorded = await recordOutcome(row, outcome);
    } catch (e) {
      // Row stays 'sending' and is reclaimed after the stale window (Resend idempotency key guards resend).
      console.error('[notify-queue] record outcome failed', shortId(row.id), e?.message || e);
      continue;
    }
    counts[recorded.status] = (counts[recorded.status] || 0) + 1;
    logOutcome(row, outcome, recorded.status);
    if (row.notification_id && recorded.status === 'sent') {
      emitNotificationEvent(NOTIFICATION_EVENTS.DELIVERED, {
        notificationId: row.notification_id,
        queueId: row.id,
        channel: row.channel,
        provider: outcome.provider || null,
      });
    } else if (row.notification_id && recorded.status === 'failed') {
      emitNotificationEvent(NOTIFICATION_EVENTS.FAILED, {
        notificationId: row.notification_id,
        queueId: row.id,
        channel: row.channel,
        errorCode: outcome.errorCode || null,
      });
    }
  }
  return { processed: rows.length, ...counts };
}

module.exports = { runNotificationQueueOnce, processRow };
