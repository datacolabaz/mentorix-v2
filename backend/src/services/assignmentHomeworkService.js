const db = require('../utils/db');
const { sendAssignmentNewEmail } = require('./studentNotificationEmailService');

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

async function notifyStudent(userId, title, body, type = 'assignment', meta = {}) {
  if (!userId) return false;
  try {
    await db.query(
      `INSERT INTO notifications (user_id, title, body, type, is_read, meta)
       VALUES ($1, $2, $3, $4, FALSE, $5::jsonb)`,
      [userId, title, body, type, JSON.stringify(meta || {})],
    );
    return true;
  } catch (err) {
    const msg = String(err?.message || '');
    if (/meta|column/i.test(msg)) {
      try {
        await db.query(
          `INSERT INTO notifications (user_id, title, body, type, is_read)
           VALUES ($1, $2, $3, $4, FALSE)`,
          [userId, title, body, type],
        );
        return true;
      } catch (err2) {
        console.error('[notifyStudent]', err2?.message || err2);
        return false;
      }
    }
    console.error('[notifyStudent]', msg);
    return false;
  }
}

async function notifyStudentsOfNewAssignment(task, studentIds, instructorName = '') {
  const title = 'Yeni tapşırıq';
  const due = task.due_date ? ` Son tarix: ${String(task.due_date).slice(0, 10)}.` : '';
  const body = `«${task.title}» — ${instructorName || 'Müəllim'} təyin etdi.${due}`;
  const meta = {
    assignment_id: task.id,
    due_date: task.due_date || null,
    instructor_name: instructorName || null,
    href: '/student/assignments',
  };

  for (const sid of studentIds) {
    await notifyStudent(sid, title, body, 'assignment_new', meta);
    sendAssignmentNewEmail({
      userId: sid,
      title: task.title,
      body: task.description || body,
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
  isDueWithinHours,
  normalizeStatus,
  notifyStudent,
  notifyStudentsOfNewAssignment,
  resolveGroupStudentIds,
};
