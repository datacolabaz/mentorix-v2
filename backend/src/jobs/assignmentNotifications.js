const db = require('../utils/db');
const {
  isPastDueYmd,
  isDueWithinHours,
  notifyStudent,
} = require('../services/assignmentHomeworkService');

async function runAssignmentNotifications() {
  const { rows: pending } = await db.query(
    `SELECT a.id AS student_assignment_id, a.student_id, a.status, a.reminder_sent_at, a.overdue_notified_at,
            t.title, t.due_date
     FROM student_assignments a
     JOIN assignments t ON t.id = a.assignment_id
     WHERE a.status IN ('pending', 'late')
       AND t.due_date IS NOT NULL`,
  );

  for (const row of pending) {
    const due = row.due_date;
    const sid = row.student_id;
    const title = row.title || 'Tapşırıq';

    if (isDueWithinHours(due, 24) && !row.reminder_sent_at) {
      await notifyStudent(
        sid,
        'Tapşırıq xatırlatması',
        `«${title}» üçün son tarixə 24 saatdan az qalıb (${String(due).slice(0, 10)}).`,
        'assignment_reminder',
      );
      await db.query(
        `UPDATE student_assignments SET reminder_sent_at = NOW() WHERE id = $1`,
        [row.student_assignment_id],
      );
    }

    if (isPastDueYmd(due) && !row.overdue_notified_at && row.status === 'pending') {
      await notifyStudent(
        sid,
        'Tapşırıq gecikib',
        `«${title}» üçün son tarix keçib. Təslim edin və ya müəllimlə əlaqə saxlayın.`,
        'assignment_overdue',
      );
      await db.query(
        `UPDATE student_assignments SET overdue_notified_at = NOW() WHERE id = $1`,
        [row.student_assignment_id],
      );
    }
  }
}

module.exports = { runAssignmentNotifications };
