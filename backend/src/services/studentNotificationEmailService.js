const { userEmailAndLocale } = require('./emailService');
const { enqueueNotification } = require('./notificationQueueService');
const { sendTemplatedEmail } = require('./email');
const { renderEmail } = require('./email/emailTemplates');
const { frontendPublicUrl } = require('./email/emailConfig');
const { checkEmailPreference } = require('./email/emailPreferenceCheck');

/** Kept for existing importers; one source of truth for the public frontend URL. */
function frontendBaseUrl() {
  return frontendPublicUrl();
}

async function recipientFor(userId, emailOverride) {
  const u = userId ? await userEmailAndLocale(userId) : { email: null, locale: null };
  const override = emailOverride && String(emailOverride).includes('@') ? String(emailOverride).trim() : null;
  return { to: override || u.email, locale: u.locale };
}

/** Legacy result shape used by callers (UI messages): ok / skipped / error. */
function legacyResult(r, extra = {}) {
  if (r.ok) return { ok: true, provider: r.provider, messageId: r.messageId || null, ...extra };
  if (r.status === 'dry_run') return { ok: false, skipped: true, reason: 'dry_run' };
  if (r.status === 'skipped') return { ok: false, skipped: true, reason: 'smtp_not_configured' };
  return { ok: false, error: r.error || 'Email xətası' };
}

async function preferenceBlocks(userId, category, eventType) {
  if (!userId) return null;
  const pref = await checkEmailPreference({ userId, category, eventType });
  return pref.allowed ? null : { ok: false, skipped: true, reason: `preference_${pref.reason}` };
}

async function sendAssignmentNewEmail({ userId, title, body, dueDate, instructorName, assignmentId }) {
  const { to, locale } = await recipientFor(userId);
  if (!to) return { ok: false, skipped: true, reason: 'no_email' };
  const blocked = await preferenceBlocks(userId, 'assignment', 'assignment_new');
  if (blocked) return blocked;

  const r = await sendTemplatedEmail({
    to,
    templateKey: 'assignment_new',
    locale,
    params: {
      title,
      description: body,
      dueDate,
      instructorName,
      url: `${frontendBaseUrl()}/student/assignments`,
    },
  });
  return legacyResult(r, { assignmentId });
}

/**
 * İmtahan giriş sorğusu təsdiqlənəndə — tələbə tətbiqdə olmasa da Gmail xəbərdarlığı.
 */
async function sendExamAccessApprovedEmail({ userId, examId, examTitle, instructorName, emailOverride = null }) {
  const { to, locale } = await recipientFor(userId, emailOverride);
  if (!to) return { ok: false, skipped: true, reason: 'no_email' };
  const blocked = await preferenceBlocks(userId, 'assessment', 'exam_access_approved');
  if (blocked) return blocked;

  const url = examId
    ? `${frontendBaseUrl()}/student/exams?exam=${encodeURIComponent(String(examId))}`
    : `${frontendBaseUrl()}/student/exams`;
  const r = await sendTemplatedEmail({
    to,
    templateKey: 'exam_access_approved',
    locale,
    params: { examTitle, instructorName, url },
  });
  return legacyResult(r, { examId });
}

/**
 * Profil tamamlanmayıb (telefon/ad) — tələbəyə yenidən link. Account/onboarding mail: no preference gate.
 */
async function sendStudentProfileCompletionEmail({
  userId,
  emailOverride = null,
  completionUrl,
  instructorName,
  studentName,
}) {
  const { to, locale } = await recipientFor(userId, emailOverride);
  if (!to) return { ok: false, skipped: true, reason: 'no_email' };

  const url = String(completionUrl || `${frontendBaseUrl()}/student`).trim();
  const params = { studentName, instructorName, url };
  const r = await sendTemplatedEmail({ to, templateKey: 'student_profile_completion', locale, params });
  if (r.ok || r.status === 'dry_run') return legacyResult(r);

  // No provider right now or a transient failure: keep the old behaviour of retrying via the outbox.
  if (r.status === 'skipped' || r.transient) {
    try {
      const email = renderEmail('student_profile_completion', locale, params);
      await enqueueNotification({
        channel: 'email',
        event_type: 'student_profile_completion',
        unique_key: `profile_completion_${userId}_${Date.now()}`,
        user_id: userId,
        to_addr: to,
        subject: email.subject,
        body: email.text,
        context: { completionUrl: url },
      });
      return { ok: true, provider: 'queue', queued: true };
    } catch (queueErr) {
      return { ok: false, skipped: true, reason: 'smtp_not_configured', error: queueErr?.message };
    }
  }
  return legacyResult(r);
}

/**
 * Canlı dərs başlayanda — tələbəyə Gmail / qeydiyyat e-poçtu.
 */
async function sendLiveClassStartedEmail({ userId, instructorName, roomTitle, liveLink }) {
  const { to, locale } = await recipientFor(userId);
  if (!to) return { ok: false, skipped: true, reason: 'no_email' };
  const blocked = await preferenceBlocks(userId, 'group', 'live_class_started');
  if (blocked) return blocked;

  const url = String(liveLink || '').trim() || `${frontendBaseUrl()}/student`;
  const r = await sendTemplatedEmail({
    to,
    templateKey: 'live_class_started',
    locale,
    params: { roomTitle, instructorName, url },
  });
  return legacyResult(r);
}

module.exports = {
  sendAssignmentNewEmail,
  sendExamAccessApprovedEmail,
  sendStudentProfileCompletionEmail,
  sendLiveClassStartedEmail,
  frontendBaseUrl,
};
