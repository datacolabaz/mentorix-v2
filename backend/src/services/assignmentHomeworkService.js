const db = require('../utils/db');

function bakuTodayYmd() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Baku',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
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
  if (st === 'late') return st;
  if (st === 'submitted' || row?.submitted_at) {
    if (row?.reviewed_at) return 'reviewed';
    return 'submitted';
  }
  if (isPastDueYmd(row?.due_date)) return 'overdue';
  return 'pending';
}

async function notifyStudent(userId, title, body, type = 'assignment') {
  if (!userId) return;
  await db
    .query(
      `INSERT INTO notifications (user_id, title, body, type, is_read)
       VALUES ($1, $2, $3, $4, FALSE)`,
      [userId, title, body, type],
    )
    .catch(() => {});
}

async function notifyStudentsOfNewAssignment(task, studentIds) {
  const title = 'Yeni tapşırıq';
  const due = task.due_date ? ` Son tarix: ${String(task.due_date).slice(0, 10)}.` : '';
  const body = `«${task.title}» tapşırığı təyin olundu.${due}`;
  for (const sid of studentIds) {
    await notifyStudent(sid, title, body, 'assignment_new');
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
  isDueWithinHours,
  normalizeStatus,
  notifyStudent,
  notifyStudentsOfNewAssignment,
  resolveGroupStudentIds,
};
