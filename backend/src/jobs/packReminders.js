const db = require('../utils/db');
const { SQL_EXCLUDE_SYSTEM_GROUP_ENROLLMENTS } = require('../services/systemGroupGuards');
const { notifyBillingOnce } = require('../services/billingNotifications');

function billingLimit(billingType) {
  if (billingType === '8_lessons') return 8;
  if (billingType === '12_lessons') return 12;
  return null;
}

function packTriggerAt(limit) {
  if (limit === 8) return 7;
  if (limit === 12) return 11;
  return null;
}

const PACK_MESSAGE = 'Növbəti dərsiniz paketinizin son dərsidir. Davam etmək üçün ödənişi nəzərə alın.';

/**
 * "Next lesson is the last one of the pack" reminder (lesson-count trigger). Delivered to the student as an
 * in-app + email payment reminder (SMS retired). Shares the dedupe key with the calendar-based reminder in
 * jobs/billingNotifications.js, so a student never gets both for the same cycle.
 */
async function runPackReminders({ dryRun = false } = {}) {
  const { rows } = await db.query(
    `WITH prog AS (
       SELECT
         e.id AS enrollment_id,
         e.instructor_id,
         e.student_id,
         e.billing_type,
         e.billing_cycle,
         COALESCE(e.notifications_enabled, TRUE) AS notifications_enabled,
         GREATEST(
           COALESCE(att.max_lesson_number, 0),
           COALESCE(les.done_lessons, 0),
           COALESCE(el.done_lessons, 0),
           COALESCE(e.lesson_count, 0)
         )::int AS lesson_count,
         COALESCE(e.pack_reminder_sent_cycle, 0)::int AS pack_reminder_sent_cycle
       FROM enrollments e
       JOIN users u ON u.id = e.student_id
       LEFT JOIN LATERAL (
        SELECT COALESCE(MAX(a.lesson_number) FILTER (WHERE a.attended = TRUE), 0) AS max_lesson_number
         FROM attendance a
         WHERE a.enrollment_id = e.id AND a.billing_cycle = e.billing_cycle
       ) att ON TRUE
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS done_lessons
         FROM lessons l
         WHERE l.enrollment_id = e.id
           AND l.billing_cycle = e.billing_cycle
          AND l.status = 'done'
          AND l.lesson_date <= NOW()
       ) les ON TRUE
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS done_lessons
         FROM enrollment_lessons el
         WHERE el.enrollment_id = e.id
           AND el.billing_cycle = e.billing_cycle
          AND el.status = 'done'
           AND el.starts_at <= NOW()
       ) el ON TRUE
       WHERE (e.status IS NULL OR LOWER(TRIM(e.status)) = 'active')
         AND u.is_active = TRUE
         AND e.billing_type IN ('8_lessons','12_lessons')
         ${SQL_EXCLUDE_SYSTEM_GROUP_ENROLLMENTS}
     )
     SELECT *
     FROM prog
     WHERE notifications_enabled = TRUE
       AND pack_reminder_sent_cycle < billing_cycle`,
    []
  );

  const sent = [];
  const skipped = [];

  for (const r of rows) {
    const limit = billingLimit(r.billing_type);
    const triggerAt = packTriggerAt(limit);
    const n = Number(r.lesson_count ?? 0) || 0;
    if (!limit || !triggerAt) {
      skipped.push({ enrollment_id: r.enrollment_id, reason: 'no_limit' });
      continue;
    }

    if (n !== triggerAt) {
      skipped.push({ enrollment_id: r.enrollment_id, reason: 'not_at_trigger', n, triggerAt, limit });
      continue;
    }

    if (!dryRun) {
      const cycle = Number(r.billing_cycle || 1) || 1;
      await notifyBillingOnce({
        userId: r.student_id,
        type: 'billing_pkg_last_lesson_student',
        title: 'Paket bitir',
        body: PACK_MESSAGE,
        priority: 'HIGH',
        meta: { enrollment_id: r.enrollment_id, billing_cycle: cycle },
        providerWorkspaceId: r.instructor_id || null,
        dedupeKey: `billing_pkg_last_lesson:${r.enrollment_id}:${cycle}`,
        email: true,
      });
      await db.query(
        `UPDATE enrollments
         SET pack_reminder_sent_cycle = billing_cycle
         WHERE id = $1`,
        [r.enrollment_id]
      );
    }

    sent.push({ enrollment_id: r.enrollment_id, n, billing_cycle: r.billing_cycle, dryRun });
  }

  return { sent, skipped, dryRun };
}

module.exports = { runPackReminders };
