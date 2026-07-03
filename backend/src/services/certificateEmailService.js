const { Resend } = require('resend');

const RESEND_API_KEY = String(process.env.RESEND_API_KEY || '').trim();
const EMAIL_FROM = String(process.env.VERIFY_EMAIL_FROM || process.env.EMAIL_FROM || '').trim();

function getBaseUrl() {
  const base = String(process.env.FRONTEND_BASE_URL || process.env.FRONTEND_URL || 'https://mentorix.az').trim();
  return base.replace(/\/+$/, '');
}

function resendClient() {
  if (!RESEND_API_KEY || !EMAIL_FROM) return null;
  return new Resend(RESEND_API_KEY);
}

async function sendCertificateIssuedEmail({ email, studentName, courseTitle, certificateNo, verificationToken }) {
  const to = String(email || '').trim();
  if (!to) return { ok: false, error: 'Email boşdur' };
  const client = resendClient();
  if (!client) return { ok: false, error: 'Email konfiqurasiya olunmayıb' };

  const verifyUrl = `${getBaseUrl()}/c/${encodeURIComponent(String(verificationToken))}`;
  const dashboardUrl = `${getBaseUrl()}/student/certificates`;
  const subject = 'Mentorix — sertifikatınız hazırdır';
  const text = [
    `Salam, ${studentName || ''}!`,
    '',
    `"${courseTitle}" üçün sertifikatınız yaradıldı.`,
    `Sertifikat ID: ${certificateNo}`,
    '',
    `Doğrulama: ${verifyUrl}`,
    `Sertifikatlar: ${dashboardUrl}`,
  ].join('\n');

  const html = `
    <div style="font-family:sans-serif;line-height:1.5;max-width:520px">
      <h3>Mentorix — sertifikatınız hazırdır</h3>
      <p>Salam, ${studentName || ''}!</p>
      <p><strong>${courseTitle}</strong> üçün sertifikatınız yaradıldı.</p>
      <p style="color:#6b7280;font-size:13px">ID: ${certificateNo}</p>
      <p><a href="${verifyUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Doğrula</a></p>
      <p><a href="${dashboardUrl}">Sertifikatlar bölməsi</a></p>
    </div>`;

  try {
    const { data, error } = await client.emails.send({ from: EMAIL_FROM, to, subject, text, html });
    if (error) return { ok: false, error: error?.message || 'Email göndərilmədi' };
    return { ok: true, messageId: data?.id || null };
  } catch (err) {
    return { ok: false, error: err?.message || 'Email xətası' };
  }
}

module.exports = { sendCertificateIssuedEmail };
