/**
 * Email intent for a new notification (decided before anything is written):
 *   skipped    — preference/policy turned email off
 *   digest     — held for a daily/weekly summary (digest job not scheduled yet)
 *   suppressed — no email route: notification email is off (EMAIL_ENABLED unset/false) and the
 *                event has no usable legacy path. Never sent later, even after email is switched on.
 *   queued     — written to notification_queue in the same statement as the notification,
 *                either as an outbox row (route 'outbox') or a rendered legacy row (route 'legacy').
 *                The worker then records dry_run | sent | failed | skipped. Whether an outbox
 *                email is really sent is decided at send time (emailConfig.notificationMode):
 *                EMAIL_ENABLED=true alone → dry_run; real sends also need EMAIL_DRY_RUN=false
 *                and a production EMAIL_ENVIRONMENT.
 */
const policy = require('../config/notificationPolicy');
const { getEmailConfig, notificationMode, providerOrder } = require('./email/emailConfig');

const EMAIL_STATUS = Object.freeze({
  SKIPPED: 'skipped',
  DIGEST: 'digest',
  SUPPRESSED: 'suppressed',
  QUEUED: 'queued',
  DRY_RUN: 'dry_run',
  SENT: 'sent',
  FAILED: 'failed',
});

const EMAIL_ROUTE = Object.freeze({ OUTBOX: 'outbox', LEGACY: 'legacy', NONE: 'none' });

/** 'off' | 'dry_run' | 'live' */
function notificationEmailMode(env = process.env) {
  return notificationMode(getEmailConfig(env));
}

/**
 * The single routing decision for an immediate notification email. Exactly one route:
 *   live notification sending                         → outbox (never legacy)
 *   not live + legacy-fallback event + SMTP configured → legacy (never outbox)
 *   not live otherwise                                → outbox in dry-run mode, none when off
 * @param {{ eventType: string, emailDecision: { eligible: boolean, frequency: string|null } }} input
 * @returns {'outbox'|'legacy'|'none'}
 */
function emailRoute({ eventType, emailDecision }, env = process.env) {
  if (!emailDecision || !emailDecision.eligible || emailDecision.frequency !== 'immediate') return EMAIL_ROUTE.NONE;
  const cfg = getEmailConfig(env);
  const mode = notificationMode(cfg);
  if (mode === 'live') return EMAIL_ROUTE.OUTBOX;
  if (policy.hasLegacyEmailFallback(eventType) && providerOrder(cfg, 'legacy_smtp').length > 0) return EMAIL_ROUTE.LEGACY;
  return mode === 'off' ? EMAIL_ROUTE.NONE : EMAIL_ROUTE.OUTBOX;
}

/**
 * @param {{ eventType?: string, emailDecision: object }} input — emailDecision = policy.resolveDelivery().email
 * @returns {{ status: string|null, route: 'outbox'|'legacy'|'none' }}
 */
function emailPlan({ eventType, emailDecision }, env = process.env) {
  if (!emailDecision) return { status: null, route: EMAIL_ROUTE.NONE };
  if (!emailDecision.eligible) {
    const silent = emailDecision.reason === 'not_requested' || emailDecision.reason === 'never_email';
    return { status: silent ? null : EMAIL_STATUS.SKIPPED, route: EMAIL_ROUTE.NONE };
  }
  if (emailDecision.frequency === 'daily' || emailDecision.frequency === 'weekly') {
    return { status: EMAIL_STATUS.DIGEST, route: EMAIL_ROUTE.NONE };
  }
  const route = emailRoute({ eventType, emailDecision }, env);
  return { status: route === EMAIL_ROUTE.NONE ? EMAIL_STATUS.SUPPRESSED : EMAIL_STATUS.QUEUED, route };
}

/** @returns {string|null} notifications.email_status */
function emailStatusFor(emailDecision, env = process.env, eventType = null) {
  return emailPlan({ eventType, emailDecision }, env).status;
}

function maskId(id) {
  const s = String(id || '');
  return s.length > 8 ? `${s.slice(0, 8)}…` : s;
}

module.exports = { EMAIL_STATUS, EMAIL_ROUTE, notificationEmailMode, emailRoute, emailPlan, emailStatusFor, maskId };
