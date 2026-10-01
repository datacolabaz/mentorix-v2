const db = require('../utils/db');
const { sendAssignmentNewEmail } = require('./studentNotificationEmailService');

function bakuTodayYmd(at = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Baku',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

function parseYmd(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/** Son tarix (Bakı günü) bitibsə */
function isPastDueYmd(dueYmd) {
  const due = parseYmd(dueYmd);
  if (!due) return false;
  return due < bakuTodayYmd();
}

/**
 * Təslimin gecikməsi: ilk təslim vaxtına görə (düzəlişə qaytarılıb yenidən göndərilən iş gecikmiş sayılmır,
 * əgər ilk təslim vaxtında olubsa). İlk təslim yoxdursa — indiki vaxta görə.
 */
function isSubmissionLate(dueYmd, firstSubmittedAt = null) {
  const due = parseYmd(dueYmd);
  if (!due) return false;
  const first = firstSubmittedAt ? new Date(firstSubmittedAt) : null;
  const at = first && !Number.isNaN(first.getTime()) ? first : new Date();
  return due < bakuTodayYmd(at);
}

function isDueWithinHours(dueYmd, hours) {
  const due = parseYmd(dueYmd);
  if (!due) return false;
  const now = new Date();
  const end = new Date(`${due}T23:59:59+04:00`);
  const diffMs = end.getTime() - now.getTime();
  return diffMs > 0 && diffMs <= hours * 3600 * 1000;
}

function normalizeStatus(row) {
  const st = String(row?.status || 'pending').toLowerCase();
  if (st === 'reviewed' || st === 'late_rejected') return st;
  if (st === 'late' || st === 'returned') return st;
  if (st === 'submitted' || row?.submitted_at) {
    if (row?.reviewed_at) return 'reviewed';
    return 'submitted';
  }
  if (isPastDueYmd(row?.due_date)) return 'overdue';
  return 'pending';
}

/**
 * Yeni tapşırıq: in-app notificationService-dən; email hələ ayrıca şablonlu göndərişdir
 * (sendAssignmentNewEmail — seçim yoxlaması orada), ona görə bildirişdə email: false.
 */
async function notifyStudentsOfNewAssignment(task, studentIds, instructorName = '') {
  const { createNotificationSafe } = require('./notificationService');
  const dueDate = task.due_date ? String(task.due_date).slice(0, 10) : '';
  const meta = {
    assignment_id: task.id,
    due_date: task.due_date || null,
    instructor_name: instructorName || null,
    href: '/student/assignments',
  };

  for (const sid of studentIds) {
    if (!sid) continue;
    const out = await createNotificationSafe({
      recipientId: sid,
      category: 'assignment',
      eventType: 'assignment_new',
      params: { assignmentTitle: task.title, instructorName: instructorName || 'Müəllim', dueDate },
      meta,
      relatedEntityType: 'assignment',
      relatedEntityId: task.id,
      actorUserId: task.instructor_id || null,
      providerWorkspaceId: task.instructor_id || null,
      groupId: task.group_id || null,
      dedupeKey: `assignment_new:${task.id}`,
      email: false,
    });
    if (out.deduped) continue;
    sendAssignmentNewEmail({
      userId: sid,
      title: task.title,
      body: task.description || task.title,
      dueDate: task.due_date,
      instructorName,
      assignmentId: task.id,
    }).catch((err) => {
      console.error('[assignment email]', sid, err?.message || err);
    });
  }
}

async function resolveGroupStudentIds(instructorId, groupId) {
  if (!groupId) return [];
  const { rows } = await db.query(
    `SELECT DISTINCT e.student_id
     FROM enrollments e
     WHERE e.instructor_id = $1
       AND e.group_id = $2::uuid
       AND e.deleted_at IS NULL
       AND COALESCE(LOWER(TRIM(e.status)), 'active') IN ('active', 'pending_setup', 'pending_approval')`,
    [instructorId, groupId],
  );
  return rows.map((r) => r.student_id).filter(Boolean);
}

module.exports = {
  bakuTodayYmd,
  parseYmd,
  isPastDueYmd,
  isSubmissionLate,
  isDueWithinHours,
  normalizeStatus,
  notifyStudentsOfNewAssignment,
  resolveGroupStudentIds,
};
