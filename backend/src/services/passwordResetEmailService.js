const crypto = require('crypto');
const { sendTemplatedEmail } = require('./email');
const { getEmailConfig } = require('./email/emailConfig');

function isConfigured() {
  const cfg = getEmailConfig();
  return cfg.resend.configured || cfg.smtp.configured;
}

function buildResetUrl(token) {
  return `${getEmailConfig().frontendPublicUrl}/reset-password?token=${encodeURIComponent(String(token))}`;
}

/** Single-use, 30-minute token link. The token is never logged (dry-run logs template + masked address only). */
async function sendPasswordResetEmail({ email, token, locale }) {
  const to = String(email || '').trim();
  if (!to) return { ok: false, error: 'Email boşdur' };

  if (!isConfigured()) {
    return { ok: false, error: 'Email konfiqurasiya olunmayıb (EMAIL_PROVIDER_API_KEY / RESEND_API_KEY və EMAIL_FROM / VERIFY_EMAIL_FROM)' };
  }

  const r = await sendTemplatedEmail({
    to,
    templateKey: 'password_reset',
    locale,
    params: { url: buildResetUrl(token), ttlMinutes: 30, ref: crypto.randomBytes(4).toString('hex') },
  });
  if (r.ok) return { ok: true, messageId: r.messageId || null };
  if (r.status === 'dry_run') return { ok: false, error: 'Email dry-run rejimindədir — göndərilmədi' };
  return { ok: false, error: r.error || 'Email göndərilmədi' };
}

module.exports = { sendPasswordResetEmail, buildResetUrl, isConfigured };
