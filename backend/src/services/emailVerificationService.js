const crypto = require('crypto');
const { Resend } = require('resend');

const RESEND_API_KEY = String(process.env.RESEND_API_KEY || '').trim();
const EMAIL_FROM = String(process.env.VERIFY_EMAIL_FROM || process.env.EMAIL_FROM || '').trim();

function getVerifyBaseUrl() {
  const base =
    String(process.env.EMAIL_VERIFICATION_BASE_URL || process.env.FRONTEND_BASE_URL || process.env.FRONTEND_URL || '')
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

function buildVerificationUrl(token) {
  return `${getVerifyBaseUrl()}/verify-email?token=${encodeURIComponent(String(token))}`;
}

async function sendVerificationEmail({ email, token }) {
  const to = String(email || '').trim();
  if (!to) return { ok: false, error: 'Email boşdur' };

  const client = resendClient();
  if (!client) {
    return {
      ok: false,
      error: 'Resend konfiqurasiya olunmayıb (RESEND_API_KEY və VERIFY_EMAIL_FROM təyin edin)',
    };
  }

  const verifyUrl = buildVerificationUrl(token);
  const safeToken = crypto.randomBytes(8).toString('hex'); // just to avoid accidental caching; not used

  const subject = 'Mentorix — e-poçt təsdiqi';

  const text = `Salam!\n\nMentorix hesabınızı aktivləşdirmək üçün e-poçt ünvanınızı təsdiqləyin:\n${verifyUrl}\n\nƏgər bu müraciəti siz etməmisinizsə, bu e-məktubu nəzərə almayın.`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.5;">
      <h3 style="margin: 0 0 12px;">Mentorix — e-poçt təsdiqi</h3>
      <p style="margin: 0 0 16px;">Salam!</p>
      <p style="margin: 0 0 16px;">Hesabınızı aktivləşdirmək üçün aşağıdakı linkə klik edin:</p>
      <p style="margin: 0 0 16px;">
        <a href="${verifyUrl}" style="color: #4f46e5; text-decoration: none;">E-poçtu təsdiqlə</a>
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;">
      <p style="margin: 0 0 6px; color: #6b7280; font-size: 12px;">Əgər bu müraciəti siz etməmisinizsə, bu e-məktubu nəzərə almayın.</p>
      <p style="margin: 0; color: #6b7280; font-size: 12px;">Ref: ${safeToken}</p>
    </div>
  `;

  const r = await client.emails.send({
    from: EMAIL_FROM,
    to,
    subject,
    text,
    html,
  });

  return { ok: true, messageId: r?.id || null };
}

module.exports = { sendVerificationEmail };

