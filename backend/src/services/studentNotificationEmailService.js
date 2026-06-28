const { Resend } = require('resend');
const { sendEmail, userEmail } = require('./emailService');
const { enqueueNotification } = require('./notificationQueueService');

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

/**
 * İmtahan giriş sorğusu təsdiqlənəndə — tələbə tətbiqdə olmasa da Gmail xəbərdarlığı.
 */
async function sendExamAccessApprovedEmail({
  userId,
  examId,
  examTitle,
  instructorName,
  emailOverride = null,
}) {
  const to =
    emailOverride && String(emailOverride).includes('@')
      ? String(emailOverride).trim()
      : await userEmail(userId);
  if (!to) return { ok: false, skipped: true, reason: 'no_email' };

  const title = String(examTitle || 'İmtahan').trim();
  const teacher = String(instructorName || 'Müəlliminiz').trim();
  const examsUrl = examId
    ? `${frontendBaseUrl()}/student/exams?exam=${encodeURIComponent(String(examId))}`
    : `${frontendBaseUrl()}/student/exams`;
  const subject = 'Mentorix — Müraciətiniz təsdiqləndi';
  const text = [
    'Salam!',
    '',
    `${teacher} «${title}» imtahanına girişinizi təsdiqlədi.`,
    '',
    'İmtahana başlamaq üçün Mentorix-də «İmtahanlar» bölməsinə daxil olun.',
    '',
    `Birbaşa keçid: ${examsUrl}`,
    '',
    'Bu e-poçtu hesabınıza daxil olduğunuz Gmail ünvanına göndərdik.',
    '',
    'Hörmətlə,',
    'Mentorix',
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.55; max-width: 520px; color: #111827;">
      <p style="margin: 0 0 12px; font-size: 13px; color: #059669; font-weight: 600;">Müraciətiniz təsdiqləndi</p>
      <p style="margin: 0 0 16px;">${escapeHtml(teacher)} <strong>«${escapeHtml(title)}»</strong> imtahanına girişinizi təsdiqlədi.</p>
      <p style="margin: 0 0 20px; color: #4b5563;">Tətbiqə daxil olmadan da bu e-poçtu oxuya bilərsiniz — imtahana başlamaq üçün aşağıdakı düyməyə klik edin.</p>
      <p style="margin: 0 0 20px;">
        <a href="${examsUrl}" style="display: inline-block; background: #4f46e5; color: #fff; padding: 12px 20px; border-radius: 10px; text-decoration: none; font-weight: 600;">İmtahanlar bölməsinə keç</a>
      </p>
      <p style="margin: 0; font-size: 12px; color: #9ca3af;">Mentorix — tələbə paneli</p>
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
      return { ok: true, provider: 'resend', messageId: data?.id || null, examId };
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

/**
 * Profil tamamlanmayıb (telefon/ad) — tələbəyə yenidən link.
 */
async function sendStudentProfileCompletionEmail({
  userId,
  emailOverride = null,
  completionUrl,
  instructorName,
  studentName,
}) {
  const to =
    emailOverride && String(emailOverride).includes('@')
      ? String(emailOverride).trim()
      : await userEmail(userId);
  if (!to) return { ok: false, skipped: true, reason: 'no_email' };

  const teacher = String(instructorName || 'Müəlliminiz').trim();
  const name = String(studentName || 'Tələbə').trim();
  const url = String(completionUrl || `${frontendBaseUrl()}/student`).trim();
  const subject = 'Mentorix — Qeydiyyatı tamamlayın';
  const text = [
    `Salam, ${name}!`,
    '',
    `${teacher} sizin qeydiyyatınızı tamamlamağınızı xahiş edir.`,
    '',
    'Müraciətiniz müəllimə yalnız aşağıdakı məlumatları doldurduqdan sonra göndəriləcək:',
    '• Ad və soyad',
    '• Mobil telefon (+994)',
    '',
    'Linkə daxil olun, Google ilə giriş edin və məlumatları doldurun:',
    url,
    '',
    'Hörmətlə,',
    'Mentorix',
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.55; max-width: 520px; color: #111827;">
      <p style="margin: 0 0 12px; font-size: 13px; color: #d97706; font-weight: 600;">Qeydiyyatı tamamlayın</p>
      <p style="margin: 0 0 16px;">${escapeHtml(teacher)} sizin qeydiyyatınızı tamamlamağınızı xahiş edir.</p>
      <p style="margin: 0 0 12px; color: #4b5563;">Müraciət müəllimə yalnız <strong>ad, soyad və mobil telefon</strong> doldurulduqdan sonra gedəcək.</p>
      <p style="margin: 0 0 20px;">
        <a href="${escapeHtml(url)}" style="display: inline-block; background: #4f46e5; color: #fff; padding: 12px 20px; border-radius: 10px; text-decoration: none; font-weight: 600;">Linkə keç və tamamla</a>
      </p>
      <p style="margin: 0; font-size: 12px; color: #9ca3af;">Mentorix — tələbə paneli</p>
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
      return { ok: true, provider: 'resend', messageId: data?.id || null };
    } catch (err) {
      return { ok: false, error: err?.message || 'Resend xətası' };
    }
  }

  try {
    const r = await sendEmail({ to, subject, text });
    if (r?.skipped) {
      try {
        await enqueueNotification({
          channel: 'email',
          event_type: 'student_profile_completion',
          unique_key: `profile_completion_${userId}_${Date.now()}`,
          user_id: userId,
          to_addr: to,
          subject,
          body: text,
          context: { completionUrl: url },
        });
        return { ok: true, provider: 'queue', queued: true };
      } catch (queueErr) {
        return { ok: false, skipped: true, reason: 'smtp_not_configured', error: queueErr?.message };
      }
    }
    return { ok: true, provider: 'smtp', messageId: r?.messageId || null };
  } catch (err) {
    try {
      await enqueueNotification({
        channel: 'email',
        event_type: 'student_profile_completion',
        unique_key: `profile_completion_${userId}_${Date.now()}`,
        user_id: userId,
        to_addr: to,
        subject,
        body: text,
        context: { completionUrl: url },
      });
      return { ok: true, provider: 'queue', queued: true };
    } catch {
      return { ok: false, error: err?.message || 'Email xətası' };
    }
  }
}

/**
 * Canlı dərs başlayanda — tələbəyə Gmail / qeydiyyat e-poçtu.
 */
async function sendLiveClassStartedEmail({ userId, instructorName, roomTitle, liveLink }) {
  const to = await userEmail(userId);
  if (!to) return { ok: false, skipped: true, reason: 'no_email' };

  const link = String(liveLink || '').trim() || `${frontendBaseUrl()}/student`;
  const title = String(roomTitle || 'Canlı dərs').trim();
  const teacher = String(instructorName || 'Müəlliminiz').trim();
  const subject = `Canlı dərs başladı — ${title}`;
  const text = [
    'Salam!',
    '',
    `${teacher} canlı dərsi başlatdı.`,
    '',
    `Dərs: ${title}`,
    '',
    `Qoşulmaq üçün: ${link}`,
    '',
    'Bu e-poçtu hesabınıza daxil olduğunuz Gmail ünvanına göndərdik.',
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.55; max-width: 520px; color: #111827;">
      <p style="margin: 0 0 12px; font-size: 13px; color: #dc2626; font-weight: 600;">Canlı dərs</p>
      <h2 style="margin: 0 0 16px; font-size: 20px;">${escapeHtml(title)}</h2>
      <p style="margin: 0 0 12px;">${escapeHtml(teacher)} canlı dərsi başlatdı. İndi qoşula bilərsiniz.</p>
      <p style="margin: 0 0 20px;">
        <a href="${escapeHtml(link)}" style="display: inline-block; background: #dc2626; color: #fff; padding: 12px 20px; border-radius: 10px; text-decoration: none; font-weight: 600;">Canlı dərsə qoşul</a>
      </p>
      <p style="margin: 0; font-size: 12px; color: #9ca3af;">Mentorix — tələbə paneli</p>
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

module.exports = {
  sendAssignmentNewEmail,
  sendExamAccessApprovedEmail,
  sendStudentProfileCompletionEmail,
  sendLiveClassStartedEmail,
  frontendBaseUrl,
};
