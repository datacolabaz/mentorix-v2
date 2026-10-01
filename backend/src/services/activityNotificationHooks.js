/**
 * Activity → notification hooks (Phase F). Callers invoke a hook only after their database
 * transaction has committed. A hook never throws into the request path and never makes the
 * request wait: the work is deferred (notificationService.deferNotification) and any email goes
 * through the async outbox. Heartbeat / autosave / view events have no hook on purpose.
 *
 * Privacy: notification text carries titles and names only — no scores, answers or feedback text.
 */
const db = require('../utils/db');

function service() {
  return require('./notificationService');
}

function safe(label, fn) {
  return (payload) => {
    try {
      return service().deferNotification(label, () => fn(payload || {}));
    } catch (e) {
      console.error('[activity-hooks]', label, e.message);
      return undefined;
    }
  };
}

function bakuYmd(at = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Baku', year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}

function epoch(v) {
  const t = v ? new Date(v).getTime() : NaN;
  return Number.isFinite(t) ? t : null;
}

async function examContext(examId, studentId) {
  const { rows } = await db.query(
    `/* hook_exam_ctx */
     SELECT e.title AS exam_title, e.instructor_id, u.full_name AS student_name
     FROM exams e
     LEFT JOIN users u ON u.id = $2
     WHERE e.id = $1
     LIMIT 1`,
    [examId, studentId || null],
  );
  return rows[0] || null;
}

async function assignmentContext(studentAssignmentId) {
  const { rows } = await db.query(
    `/* hook_assignment_ctx */
     SELECT sa.id, sa.assignment_id, sa.student_id, sa.reviewed_at, sa.returned_at,
            a.title, a.instructor_id, a.group_id, u.full_name AS student_name
     FROM student_assignments sa
     JOIN assignments a ON a.id = sa.assignment_id
     LEFT JOIN users u ON u.id = sa.student_id
     WHERE sa.id = $1
     LIMIT 1`,
    [studentAssignmentId],
  );
  return rows[0] || null;
}

function studentLabel(name) {
  return String(name || '').trim() || 'Tələbə';
}

async function notifyTeacherExam(p, { auto }) {
  const ctx = await examContext(p.examId, p.studentId);
  const instructorId = p.instructorId || ctx?.instructor_id;
  if (!ctx || !instructorId || !p.examResultId) return null;
  const pending = Boolean(p.gradingPending);
  const eventType = auto ? 'exam_auto_submitted' : 'exam_submitted';
  return service().createNotificationSafe({
    recipientId: instructorId,
    category: pending ? 'grading' : 'assessment',
    eventType,
    templateKey: pending ? `${eventType}_review` : eventType,
    priority: pending ? 'HIGH' : 'NORMAL',
    params: { studentName: studentLabel(ctx.student_name), examTitle: ctx.exam_title || '' },
    meta: { exam_id: p.examId, result_id: p.examResultId, grading_pending: pending },
    relatedEntityType: 'exam',
    relatedEntityId: p.examId,
    actorUserId: p.studentId || null,
    providerWorkspaceId: instructorId,
    dedupeKey: auto ? `exam_expired:${p.examResultId}` : `exam_submitted:${p.examResultId}`,
    email: false,
  });
}

/** Teacher: a student submitted an assessment (HIGH + grading category when manual grading is pending). */
const onAssessmentSubmitted = safe('exam_submitted', (p) => notifyTeacherExam(p, { auto: false }));

/** Teacher: time ran out and the answers were submitted automatically. */
const onAssessmentAutoSubmitted = safe('exam_auto_submitted', (p) => notifyTeacherExam(p, { auto: true }));

/** Teacher: one LOW summary per assessment per day (no per-student notification, no email). */
const onAssessmentExpiredNoAnswers = safe('exam_expired_no_answers', async (p) => {
  const ctx = await examContext(p.examId, null);
  const instructorId = p.instructorId || ctx?.instructor_id;
  if (!ctx || !instructorId) return null;
  return service().createNotificationSafe({
    recipientId: instructorId,
    category: 'assessment',
    eventType: 'exam_expired_no_answers',
    priority: 'LOW',
    params: { examTitle: ctx.exam_title || '' },
    meta: { exam_id: p.examId },
    relatedEntityType: 'exam',
    relatedEntityId: p.examId,
    providerWorkspaceId: instructorId,
    dedupeKey: `exam_expired_no_answers:${p.examId}:${bakuYmd()}`,
    email: false,
  });
});

/** Student: the result is now visible. No score in the text. */
const onResultReleased = safe('exam_result_released', async (p) => {
  if (!p.studentId) return null;
  const ctx = await examContext(p.examId, null);
  if (!ctx) return null;
  return service().createNotificationSafe({
    recipientId: p.studentId,
    category: 'assessment',
    eventType: 'exam_result_released',
    params: { examTitle: ctx.exam_title || '' },
    meta: { exam_id: p.examId, href: '/student/exams' },
    relatedEntityType: 'exam',
    relatedEntityId: p.examId,
    actorUserId: p.instructorId || ctx.instructor_id || null,
    providerWorkspaceId: p.instructorId || ctx.instructor_id || null,
    dedupeKey: `result_released:${p.examId}:${p.studentId}`,
    email: true,
  });
});

/** Teacher: assignment submitted (or submitted late). One per submission. */
const onAssignmentSubmitted = safe('assignment_submitted', async (p) => {
  const ctx = await assignmentContext(p.studentAssignmentId);
  if (!ctx) return null;
  const late = Boolean(p.late);
  const submissionCount = Number(p.submissionCount) || 1;
  return service().createNotificationSafe({
    recipientId: ctx.instructor_id,
    category: 'assignment',
    eventType: late ? 'assignment_late_submitted' : 'assignment_submitted',
    priority: late ? 'HIGH' : 'NORMAL',
    params: { studentName: studentLabel(ctx.student_name), assignmentTitle: ctx.title || '' },
    meta: { assignment_id: ctx.assignment_id, late, submission_count: submissionCount },
    relatedEntityType: 'student_assignment',
    relatedEntityId: ctx.id,
    actorUserId: ctx.student_id,
    providerWorkspaceId: ctx.instructor_id,
    groupId: ctx.group_id || null,
    dedupeKey: `assignment_submitted:${ctx.id}:${submissionCount}`,
    email: true,
  });
});

/** Student: work returned for revision. Feedback text stays on the assignment page. */
const onAssignmentReturnedForRevision = safe('assignment_returned', async (p) => {
  const ctx = await assignmentContext(p.studentAssignmentId);
  if (!ctx) return null;
  const at = epoch(p.returnedAt) ?? epoch(ctx.returned_at);
  return service().createNotificationSafe({
    recipientId: ctx.student_id,
    category: 'assignment',
    eventType: 'assignment_returned',
    priority: 'HIGH',
    params: { assignmentTitle: ctx.title || '' },
    meta: { assignment_id: ctx.assignment_id, href: '/student/assignments' },
    relatedEntityType: 'assignment',
    relatedEntityId: ctx.assignment_id,
    actorUserId: p.instructorId || ctx.instructor_id,
    providerWorkspaceId: ctx.instructor_id,
    groupId: ctx.group_id || null,
    dedupeKey: `assignment_returned:${ctx.id}:${at ?? 'x'}`,
    email: true,
  });
});

/** Student: work reviewed (score and/or feedback saved). Score and feedback are not in the text. */
const onAssignmentGraded = safe('assignment_reviewed', async (p) => {
  const ctx = await assignmentContext(p.studentAssignmentId);
  if (!ctx || !ctx.reviewed_at) return null;
  return service().createNotificationSafe({
    recipientId: ctx.student_id,
    category: 'grading',
    eventType: 'assignment_reviewed',
    params: { assignmentTitle: ctx.title || '' },
    meta: { assignment_id: ctx.assignment_id, href: '/student/assignments' },
    relatedEntityType: 'assignment',
    relatedEntityId: ctx.assignment_id,
    actorUserId: ctx.instructor_id,
    providerWorkspaceId: ctx.instructor_id,
    groupId: ctx.group_id || null,
    dedupeKey: `assignment_graded:${ctx.id}:${epoch(ctx.reviewed_at)}`,
    email: true,
  });
});

module.exports = {
  onAssessmentSubmitted,
  onAssessmentAutoSubmitted,
  onAssessmentExpiredNoAnswers,
  onResultReleased,
  onAssignmentSubmitted,
  onAssignmentReturnedForRevision,
  onAssignmentGraded,
};
