const { Resend } = require('resend');
const { sendEmail, userEmail } = require('./emailService');

const RESEND_API_KEY = String(process.env.RESEND_API_KEY || '').trim();
const EMAIL_FROM = String(process.env.VERIFY_EMAIL_FROM || process.env.EMAIL_FROM || '').trim();

function frontendBaseUrl() {
  const base = String(
    process.env.FRONTEND_BASE_URL || process.env.FRONTEND_URL || process.env.EMAIL_VERIFICATION_BASE_URL || '',
  )
    .trim()
    .replace(/\/+$/, '');
  return base || 'https://mentorix.az';
}

function resendReady() {
  return Boolean(RESEND_API_KEY && EMAIL_FROM);
}

async function sendAssignmentNewEmail({ userId, title, body, dueDate, instructorName, assignmentId }) {
  const to = await userEmail(userId);
  if (!to) return { ok: false, skipped: true, reason: 'no_email' };

  const appUrl = `${frontendBaseUrl()}/student/assignments`;
  const dueLine = dueDate ? `Son tarix: ${String(dueDate).slice(0, 10)}` : 'Son tarix təyin olunmayıb';
  const subject = `Yeni tapşırıq — ${title}`;
  const text = [
    'Salam!',
    '',
    `${instructorName || 'Müəlliminiz'} sizə yeni ev tapşırığı təyin etdi.`,
    '',
    `Tapşırıq: ${title}`,
    dueLine,
    '',
    body || '',
    '',
    `Platformada açın: ${appUrl}`,
    '',
    'Bu e-poçtu hesabınıza daxil olduğunuz Gmail ünvanına göndərdik.',
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.55; max-width: 520px; color: #111827;">
      <p style="margin: 0 0 12px; font-size: 13px; color: #6366f1; font-weight: 600;">Yeni tapşırıq</p>
      <h2 style="margin: 0 0 16px; font-size: 20px;">${escapeHtml(title)}</h2>
      <p style="margin: 0 0 12px;">${escapeHtml(instructorName || 'Müəlliminiz')} sizə platformada yeni ev tapşırığı təyin etdi.</p>
      <p style="margin: 0 0 8px;"><strong>${escapeHtml(dueLine)}</strong></p>
      ${body ? `<p style="margin: 0 0 16px; color: #4b5563;">${escapeHtml(body)}</p>` : ''}
      <p style="margin: 0 0 20px;">
        <a href="${appUrl}" style="display: inline-block; background: #4f46e5; color: #fff; padding: 12px 20px; border-radius: 10px; text-decoration: none; font-weight: 600;">Tapşırıqlarım bölməsinə keç</a>
      </p>
      <p style="margin: 0; font-size: 12px; color: #9ca3af;">Mentorix / EduPanel — tələbə paneli</p>
    </div>
  `;

  if (resendReady()) {
    try {
      const client = new Resend(RESEND_API_KEY);
      const { data, error } = await client.emails.send({
        from: EMAIL_FROM,
        to,
        subject,
        text,
        html,
      });
      if (error) {
        return { ok: false, error: error?.message || 'Resend xətası' };
      }
      return { ok: true, provider: 'resend', messageId: data?.id || null, assignmentId };
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

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = {
  sendAssignmentNewEmail,
  frontendBaseUrl,
};
