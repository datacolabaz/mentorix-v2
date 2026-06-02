const crypto = require('crypto');
const { Resend } = require('resend');

const RESEND_API_KEY = String(process.env.RESEND_API_KEY || '').trim();
const EMAIL_FROM = String(process.env.VERIFY_EMAIL_FROM || process.env.EMAIL_FROM || '').trim();

function getBaseUrl() {
  const base = String(process.env.FRONTEND_BASE_URL || process.env.FRONTEND_URL || process.env.EMAIL_VERIFICATION_BASE_URL || '')
    .trim() || 'https://mentorix.az';
  return base.replace(/\/+$/, '');
}

function isConfigured() {
  return Boolean(RESEND_API_KEY && EMAIL_FROM);
}

function resendClient() {
  if (!isConfigured()) return null;
  return new Resend(RESEND_API_KEY);
}

function buildResetUrl(token) {
  return `${getBaseUrl()}/reset-password?token=${encodeURIComponent(String(token))}`;
}

async function sendPasswordResetEmail({ email, token }) {
  const to = String(email || '').trim();
  if (!to) return { ok: false, error: 'Email boşdur' };

  const client = resendClient();
  if (!client) {
    return { ok: false, error: 'Resend konfiqurasiya olunmayıb (RESEND_API_KEY və VERIFY_EMAIL_FROM təyin edin)' };
  }

  const resetUrl = buildResetUrl(token);
  const ref = crypto.randomBytes(4).toString('hex');
  const subject = 'Mentorix — parol bərpası';

  const text = [
    'Salam!',
    '',
    'Parolunuzu yeniləmək üçün bu linkə daxil olun:',
    resetUrl,
    '',
    'Bu link 30 dəqiqə ərzində etibarlıdır.',
    'Əgər bu müraciəti siz etməmisinizsə, bu e-məktubu nəzərə almayın.',
    `Ref: ${ref}`,
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.5; max-width: 520px;">
      <h3 style="margin: 0 0 12px;">Mentorix — parol bərpası</h3>
      <p style="margin: 0 0 16px;">Salam!</p>
      <p style="margin: 0 0 16px;">Parolunuzu yeniləmək üçün aşağıdakı düyməyə klik edin:</p>
      <p style="margin: 0 0 16px;">
        <a href="${resetUrl}" style="display: inline-block; background: #4f46e5; color: #fff; padding: 10px 18px; border-radius: 8px; text-decoration: none;">Parolu yenilə</a>
      </p>
      <p style="margin: 0 0 8px; color: #6b7280; font-size: 12px;">Link: <a href="${resetUrl}">${resetUrl}</a></p>
      <p style="margin: 0 0 8px; color: #6b7280; font-size: 12px;">Link 30 dəqiqə ərzində etibarlıdır.</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;">
      <p style="margin: 0; color: #6b7280; font-size: 12px;">Əgər bu müraciəti siz etməmisinizsə, bu e-məktubu nəzərə almayın. Ref: ${ref}</p>
    </div>
  `;

  try {
    const { data, error } = await client.emails.send({ from: EMAIL_FROM, to, subject, text, html });
    if (error) {
      const msg = error?.message || (typeof error === 'string' ? error : null) || 'Resend email göndərmədi';
      return { ok: false, error: msg };
    }
    return { ok: true, messageId: data?.id || null };
  } catch (err) {
    return { ok: false, error: err?.message || 'Resend xətası' };
  }
}

module.exports = { sendPasswordResetEmail, buildResetUrl, isConfigured };

