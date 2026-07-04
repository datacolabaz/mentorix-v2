const { Resend } = require('resend');
const { sendEmail } = require('./emailService');

const RESEND_API_KEY = String(process.env.RESEND_API_KEY || '').trim();
const EMAIL_FROM = String(process.env.VERIFY_EMAIL_FROM || process.env.EMAIL_FROM || '').trim();

function frontendBaseUrl() {
  const base = String(
    process.env.FRONTEND_BASE_URL || process.env.FRONTEND_URL || 'https://mentorix.az',
  )
    .trim()
    .replace(/\/+$/, '');
  return base || 'https://mentorix.az';
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function resendReady() {
  return Boolean(RESEND_API_KEY && EMAIL_FROM);
}

/**
 * @param {{ to: string, categoryName: string, examTitle: string, categorySlug: string, examId: string }} opts
 */
async function sendCatalogWaitlistEmail({ to, categoryName, examTitle, categorySlug, examId }) {
  const link = `${frontendBaseUrl()}/sertifikatli-imtahanlar/${encodeURIComponent(categorySlug)}?exam=${encodeURIComponent(examId)}`;
  const subject = `${categoryName} — yeni sertifikatlı imtahan`;
  const text = [
    'Salam!',
    '',
    `${categoryName} kateqoriyasında yeni imtahan əlavə olundu: ${examTitle}.`,
    '',
    'Sertifikat qazanmaq üçün indi başla:',
    link,
    '',
    'Mentorix — skill assessment kataloqu',
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.55; max-width: 520px; color: #111827;">
      <p style="margin: 0 0 12px; font-size: 13px; color: #00a86b; font-weight: 600;">Yeni imtahan</p>
      <h2 style="margin: 0 0 12px; font-size: 20px;">${escapeHtml(categoryName)}</h2>
      <p style="margin: 0 0 16px; color: #374151;">
        Bu kateqoriyada yeni sertifikatlı imtahan əlavə olundu:
        <strong>${escapeHtml(examTitle)}</strong>
      </p>
      <p style="margin: 0 0 20px;">
        <a href="${link}" style="display: inline-block; background: #00E676; color: #041018; padding: 12px 20px; border-radius: 10px; text-decoration: none; font-weight: 700;">İmtahana başla →</a>
      </p>
      <p style="margin: 0; font-size: 12px; color: #9ca3af;">Mentorix — sertifikatlı imtahan kataloqu</p>
    </div>
  `;

  if (resendReady()) {
    try {
      const client = new Resend(RESEND_API_KEY);
      const { data, error } = await client.emails.send({ from: EMAIL_FROM, to, subject, text, html });
      if (error) return { ok: false, error: error?.message || 'Resend xətası' };
      return { ok: true, provider: 'resend', messageId: data?.id || null };
    } catch (err) {
      return { ok: false, error: err?.message || 'Resend xətası' };
    }
  }

  try {
    const r = await sendEmail({ to, subject, text });
    if (r?.skipped) return { ok: false, skipped: true, reason: 'smtp_not_configured' };
    return { ok: true, provider: 'smtp', messageId: r?.messageId || null };
  } catch (err) {
    return { ok: false, error: err?.message || 'Email xətası' };
  }
}

module.exports = { sendCatalogWaitlistEmail, frontendBaseUrl };
