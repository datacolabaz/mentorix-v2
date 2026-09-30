const { sendTemplatedEmail } = require('./email');
const { getEmailConfig } = require('./email/emailConfig');

function isConfigured() {
  const cfg = getEmailConfig();
  return cfg.resend.configured || cfg.smtp.configured;
}

function buildVerificationUrl(token) {
  return `${getEmailConfig().verificationBaseUrl}/verify-email?token=${encodeURIComponent(String(token))}`;
}

/** Code + single-use expiring link. Neither is ever logged. */
async function sendVerificationEmail({ email, token, code, locale }) {
  const to = String(email || '').trim();
  if (!to) return { ok: false, error: 'Email boşdur' };

  if (!isConfigured()) {
    return {
      ok: false,
      error: 'Email konfiqurasiya olunmayıb (EMAIL_PROVIDER_API_KEY / RESEND_API_KEY və EMAIL_FROM / VERIFY_EMAIL_FROM)',
    };
  }

  const r = await sendTemplatedEmail({
    to,
    templateKey: 'email_verification',
    locale,
    params: {
      url: buildVerificationUrl(token),
      code: code != null ? String(code).trim() : '',
      ttlMinutes: Number(process.env.EMAIL_VERIFICATION_TTL_MINUTES || 60),
    },
  });
  if (r.ok) return { ok: true, messageId: r.messageId || null };
  if (r.status === 'dry_run') return { ok: false, error: 'Email dry-run rejimindədir — göndərilmədi' };
  return { ok: false, error: r.error || 'Email göndərilmədi' };
}

module.exports = { sendVerificationEmail, buildVerificationUrl, isConfigured };
