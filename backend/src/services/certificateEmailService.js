const { userEmailAndLocale } = require('./emailService');
const { readCertificateFileBuffer } = require('./certificateFileStorage');
const { sendTemplatedEmail } = require('./email');

// Keep certificate links on mentorix.io (QR + email links must be reachable).
const CERT_SITE_ORIGIN = 'https://mentorix.io';

function getBaseUrl() {
  return CERT_SITE_ORIGIN;
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
  const account = userId ? await userEmailAndLocale(userId) : { email: null, locale: null };
  const to = String(email || '').trim() || account.email || '';
  if (!to) return { ok: false, skipped: true, reason: 'no_email' };

  let attachmentBuffer = pdfBuffer;
  if (!attachmentBuffer?.length && pdfFilename) {
    const file = await readCertificateFileBuffer(pdfFilename);
    attachmentBuffer = file?.buffer;
  }

  const safeCertNo = String(certificateNo || '').trim();
  const attachments = attachmentBuffer?.length
    ? [{ filename: `${safeCertNo || 'mentorix-certificate'}.pdf`, content: attachmentBuffer }]
    : undefined;

  const r = await sendTemplatedEmail({
    to,
    templateKey: 'certificate_issued',
    locale: account.locale,
    attachments,
    params: {
      studentName,
      courseTitle,
      certificateNo: safeCertNo,
      verifyUrl: `${getBaseUrl()}/c/${encodeURIComponent(String(verificationToken))}`,
      dashboardUrl: `${getBaseUrl()}/student/certificates`,
    },
  });
  if (r.ok) return { ok: true, provider: r.provider, messageId: r.messageId || null, to };
  if (r.status === 'dry_run') return { ok: false, skipped: true, reason: 'dry_run' };
  if (r.status === 'skipped') return { ok: false, skipped: true, reason: 'smtp_not_configured' };
  return { ok: false, error: r.error || 'Email xətası' };
}

module.exports = { sendCertificateIssuedEmail };
