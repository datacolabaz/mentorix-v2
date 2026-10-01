const db = require('../utils/db');
const { isPastDueYmd, isDueWithinHours, parseYmd } = require('../services/assignmentHomeworkService');
const { createNotificationSafe } = require('../services/notificationService');
const { REMINDER_COOLDOWN_HOURS } = require('../services/activityReportRules');

/**
 * Saatlıq: son tarixə <24 saat qalan tapşırıq üçün avtomatik xatırlatma və gecikmə bildirişi.
 * student_assignments.reminder_sent_at yalnız avtomatik xatırlatmanı izləyir; müəllimin əl ilə
 * xatırlatması reminder_log-dadır və avtomatiki söndürmür — yalnız son REMINDER_COOLDOWN_HOURS saatda
 * əl ilə xatırlatma olubsa, avtomatik növbəti saata qalır.
 * Köhnə (yerləşdirmədən əvvəlki) sətirlərdə reminder_sent_at əl ilə xatırlatmadan yazılmış ola bilər:
 * həmin anda (±2 dəq) reminder_log 'sent' sətri varsa, bu avtomatik xatırlatma sayılmır.
 */
const PENDING_SQL = `
  SELECT a.id AS student_assignment_id, a.student_id, a.status, a.reminder_sent_at, a.overdue_notified_at,
         t.id AS assignment_id, t.instructor_id, t.title, t.due_date,
         (SELECT MAX(rl.sent_at) FROM reminder_log rl
           WHERE rl.entity_type = 'assignment' AND rl.entity_id = t.id
             AND rl.student_id = a.student_id AND rl.status = 'sent') AS last_manual_reminder_at,
         (a.reminder_sent_at IS NOT NULL AND EXISTS (
           SELECT 1 FROM reminder_log rl
           WHERE rl.entity_type = 'assignment' AND rl.entity_id = t.id
             AND rl.student_id = a.student_id AND rl.status = 'sent'
             AND rl.sent_at BETWEEN a.reminder_sent_at - INTERVAL '2 minutes' AND a.reminder_sent_at + INTERVAL '2 minutes'
         )) AS reminder_sent_by_manual
  FROM student_assignments a
  JOIN assignments t ON t.id = a.assignment_id
  WHERE a.status IN ('pending', 'late')
    AND t.due_date IS NOT NULL`;

function withinCooldown(lastManualAt, now) {
  if (!lastManualAt) return false;
  const t = new Date(lastManualAt).getTime();
  return Number.isFinite(t) && now.getTime() - t < REMINDER_COOLDOWN_HOURS * 3600 * 1000;
}

function settled(out) {
  return Boolean(out && (out.created || out.deduped || out.reason === 'disabled_by_preference' || out.reason === 'recipient_not_found'));
}

async function runAssignmentNotifications({ now = new Date() } = {}) {
  const { rows: pending } = await db.query(PENDING_SQL);
  const stats = { reminded: 0, deferred: 0, overdue: 0 };

  for (const row of pending) {
    const due = row.due_date;
    const dueYmd = parseYmd(due) || String(due).slice(0, 10);
    const sid = row.student_id;
    const title = row.title || 'Tapşırıq';
    const autoReminderSent = Boolean(row.reminder_sent_at) && !row.reminder_sent_by_manual;

    if (isDueWithinHours(due, 24) && !autoReminderSent) {
      if (withinCooldown(row.last_manual_reminder_at, now)) {
        stats.deferred += 1;
      } else {
        const out = await createNotificationSafe({
          recipientId: sid,
          category: 'assignment',
          eventType: 'assignment_reminder',
          templateKey: 'assignment_due_soon',
          params: { assignmentTitle: title, dueDate: dueYmd },
          meta: { assignment_id: row.assignment_id, reminder_kind: 'auto', href: '/student/assignments' },
          relatedEntityType: 'assignment',
          relatedEntityId: row.assignment_id,
          providerWorkspaceId: row.instructor_id || null,
          dedupeKey: `assignment_reminder:auto:${row.student_assignment_id}:${dueYmd}`,
          email: false,
        });
        if (settled(out)) {
          await db.query(`UPDATE student_assignments SET reminder_sent_at = NOW() WHERE id = $1`, [row.student_assignment_id]);
          if (out.created) stats.reminded += 1;
        }
      }
    }

    if (isPastDueYmd(due) && !row.overdue_notified_at && row.status === 'pending') {
      const out = await createNotificationSafe({
        recipientId: sid,
        category: 'assignment',
        eventType: 'assignment_overdue',
        priority: 'HIGH',
        params: { assignmentTitle: title },
        meta: { assignment_id: row.assignment_id, href: '/student/assignments' },
        relatedEntityType: 'assignment',
        relatedEntityId: row.assignment_id,
        providerWorkspaceId: row.instructor_id || null,
        dedupeKey: `assignment_overdue:${row.student_assignment_id}`,
        email: false,
      });
      if (settled(out)) {
        await db.query(`UPDATE student_assignments SET overdue_notified_at = NOW() WHERE id = $1`, [row.student_assignment_id]);
        if (out.created) stats.overdue += 1;
      }
    }
  }
  return stats;
}

module.exports = { runAssignmentNotifications, PENDING_SQL };
