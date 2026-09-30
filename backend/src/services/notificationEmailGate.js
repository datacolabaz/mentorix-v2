/**
 * Email intent for a new notification (decided before anything is written):
 *   skipped    — preference/policy turned email off
 *   digest     — held for a daily/weekly summary (digest job not scheduled yet)
 *   suppressed — email channel globally off (EMAIL_ENABLED unset/false). Nothing is queued and
 *                these rows are never sent later, even after email is switched on.
 *   queued     — written to notification_queue in the same statement as the notification.
 *                The worker then records dry_run | sent | failed | skipped. Whether a queued
 *                email is really sent is decided at send time (emailConfig.notificationMode):
 *                EMAIL_ENABLED=true alone → dry_run; real sends also need EMAIL_DRY_RUN=false
 *                and a production EMAIL_ENVIRONMENT.
 */
const { getEmailConfig, notificationMode } = require('./email/emailConfig');

const EMAIL_STATUS = Object.freeze({
  SKIPPED: 'skipped',
  DIGEST: 'digest',
  SUPPRESSED: 'suppressed',
  QUEUED: 'queued',
  DRY_RUN: 'dry_run',
  SENT: 'sent',
  FAILED: 'failed',
});

/** 'off' | 'dry_run' | 'live' */
function notificationEmailMode(env = process.env) {
  return notificationMode(getEmailConfig(env));
}

/**
 * @param {{ eligible: boolean, frequency: string|null, reason: string }} emailDecision — policy.resolveDelivery().email
 * @returns {string|null} notifications.email_status
 */
function emailStatusFor(emailDecision, env = process.env) {
  if (!emailDecision) return null;
  if (!emailDecision.eligible) {
    if (emailDecision.reason === 'not_requested' || emailDecision.reason === 'never_email') return null;
    return EMAIL_STATUS.SKIPPED;
  }
  if (emailDecision.frequency === 'daily' || emailDecision.frequency === 'weekly') return EMAIL_STATUS.DIGEST;
  return notificationEmailMode(env) === 'off' ? EMAIL_STATUS.SUPPRESSED : EMAIL_STATUS.QUEUED;
}

function maskId(id) {
  const s = String(id || '');
  return s.length > 8 ? `${s.slice(0, 8)}…` : s;
}

module.exports = { EMAIL_STATUS, notificationEmailMode, emailStatusFor, maskId };
