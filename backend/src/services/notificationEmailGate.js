/**
 * Yeni bildiriş emailləri üçün qapı (Phase A).
 * Bu mərhələdə heç bir email GÖNDƏRİLMİR və `notification_queue`-ya sətir yazılmır
 * (mövcud SMTP worker-i onları göndərə bilməsin deyə). Yalnız niyyət/status qeyd olunur:
 *   skipped    — seçim/siyasət emaili söndürüb
 *   digest     — gündəlik/həftəlik xülasəyə saxlanılıb (planlaşdırma Phase B/sonra)
 *   suppressed — email kanalı qlobal söndürülüb (default; domen təsdiqlənənə qədər)
 *   dry_run    — EMAIL_ENABLED=true, amma göndərmə yoxdur; yalnız təhlükəsiz log
 * Phase B: `suppressed` sətirləri sonradan göndərilməməlidir (köhnə backlog).
 */

const EMAIL_STATUS = Object.freeze({
  SKIPPED: 'skipped',
  DIGEST: 'digest',
  SUPPRESSED: 'suppressed',
  DRY_RUN: 'dry_run',
});

function isTrue(v) {
  return ['1', 'true', 'yes', 'on'].includes(String(v || '').trim().toLowerCase());
}

/** Spec adları: EMAIL_ENABLED, EMAIL_DRY_RUN. Default: söndürülüb. */
function notificationEmailMode(env = process.env) {
  if (!isTrue(env.EMAIL_ENABLED)) return 'off';
  return 'dry_run';
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
  return notificationEmailMode(env) === 'dry_run' ? EMAIL_STATUS.DRY_RUN : EMAIL_STATUS.SUPPRESSED;
}

function maskId(id) {
  const s = String(id || '');
  return s.length > 8 ? `${s.slice(0, 8)}…` : s;
}

/** Heç vaxt email ünvanı, başlıq və ya mətn loglanmır. */
function logDryRun({ notificationId, recipientId, eventType }) {
  console.log(
    `[notify-email:dry_run] template=${eventType} recipient=${maskId(recipientId)} notification=${maskId(notificationId)}`,
  );
}

module.exports = { EMAIL_STATUS, notificationEmailMode, emailStatusFor, logDryRun, maskId };
