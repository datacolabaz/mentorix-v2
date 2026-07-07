const { Resend } = require('resend');
const { sendEmail, userEmail } = require('./emailService');
const { readCertificateFileBuffer } = require('./certificateFileStorage');

const RESEND_API_KEY = String(process.env.RESEND_API_KEY || '').trim();
const EMAIL_FROM = String(process.env.VERIFY_EMAIL_FROM || process.env.EMAIL_FROM || '').trim();

function getBaseUrl() {
  const base = String(process.env.FRONTEND_BASE_URL || process.env.FRONTEND_URL || 'https://mentorix.io').trim();
  return base.replace(/\/+$/, '');
}

function resendReady() {
  return Boolean(RESEND_API_KEY && EMAIL_FROM);
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function sendCertificateIssuedEmail({
  userId,
  email,
  studentName,
  courseTitle,
  certificateNo,
  verificationToken,
  pdfFilename,
  pdfBuffer,
}) {
  let to = String(email || '').trim();
  if (!to && userId) to = (await userEmail(userId)) || '';
  if (!to) return { ok: false, skipped: true, reason: 'no_email' };

  let attachmentBuffer = pdfBuffer;
  if (!attachmentBuffer?.length && pdfFilename) {
    const file = await readCertificateFileBuffer(pdfFilename);
    attachmentBuffer = file?.buffer;
  }

  const verifyUrl = `${getBaseUrl()}/c/${encodeURIComponent(String(verificationToken))}`;
  const dashboardUrl = `${getBaseUrl()}/student/certificates`;
  const safeName = String(studentName || 'Tələbə').trim();
  const safeCourse = String(courseTitle || 'İmtahan').trim();
  const safeCertNo = String(certificateNo || '').trim();
  const subject = 'Mentorix — sertifikatınız hazırdır';
  const text = [
    `Salam, ${safeName}!`,
    '',
    `"${safeCourse}" üçün sertifikatınız yaradıldı.`,
    `Sertifikat ID: ${safeCertNo}`,
    '',
    'PDF sertifikat bu e-poçta əlavə olunub (əlavə varsa).',
    `Doğrulama: ${verifyUrl}`,
    `Sertifikatlar bölməsi: ${dashboardUrl}`,
    '',
    'Bu e-poçtu hesabınıza daxil olduğunuz ünvana göndərdik.',
    '',
    'Hörmətlə,',
    'Mentorix',
  ].join('\n');

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;line-height:1.55;max-width:520px;color:#111827">
      <p style="margin:0 0 12px;font-size:13px;color:#6366f1;font-weight:600">Sertifikat</p>
      <h2 style="margin:0 0 16px;font-size:20px">Sertifikatınız hazırdır</h2>
      <p style="margin:0 0 12px">Salam, ${escapeHtml(safeName)}!</p>
      <p style="margin:0 0 12px"><strong>${escapeHtml(safeCourse)}</strong> üçün sertifikatınız yaradıldı.</p>
      <p style="margin:0 0 16px;color:#6b7280;font-size:13px">ID: ${escapeHtml(safeCertNo)}</p>
      <p style="margin:0 0 20px">
        <a href="${verifyUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">Doğrula</a>
      </p>
      <p style="margin:0 0 8px"><a href="${dashboardUrl}">Sertifikatlar bölməsinə keç</a></p>
      <p style="margin:0;font-size:12px;color:#9ca3af">PDF əlavə olunub (mümkündürsə).</p>
    </div>`;

  const attachments = attachmentBuffer?.length
    ? [{ filename: `${safeCertNo || 'mentorix-certificate'}.pdf`, content: attachmentBuffer }]
    : undefined;

  if (resendReady()) {
    try {
      const client = new Resend(RESEND_API_KEY);
      const { data, error } = await client.emails.send({
        from: EMAIL_FROM,
        to,
        subject,
        text,
        html,
        attachments,
      });
      if (error) return { ok: false, error: error?.message || 'Resend xətası' };
      return { ok: true, provider: 'resend', messageId: data?.id || null, to };
    } catch (err) {
      return { ok: false, error: err?.message || 'Resend xətası' };
    }
  }

  try {
    const r = await sendEmail({ to, subject, text, attachments });
    if (r?.skipped) return { ok: false, skipped: true, reason: 'smtp_not_configured' };
    return { ok: true, provider: 'smtp', messageId: r?.messageId || null, to };
  } catch (err) {
    return { ok: false, error: err?.message || 'Email xətası' };
  }
}

module.exports = { sendCertificateIssuedEmail };
