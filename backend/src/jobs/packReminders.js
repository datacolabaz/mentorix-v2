const db = require('../utils/db');
const { sendSms } = require('../services/smsService');

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
         COALESCE(u.full_name, '') AS student_name,
         u.phone AS student_phone,
         COALESCE(NULLIF(TRIM(sp.parent_phone), ''), pu.phone) AS parent_phone,
         GREATEST(
           COALESCE(att.max_lesson_number, 0),
           COALESCE(les.done_lessons, 0),
           COALESCE(el.done_lessons, 0),
           COALESCE(e.lesson_count, 0)
         )::int AS lesson_count,
         COALESCE(e.pack_reminder_sent_cycle, 0)::int AS pack_reminder_sent_cycle
       FROM enrollments e
       JOIN users u ON u.id = e.student_id
       LEFT JOIN student_profiles sp ON sp.user_id = e.student_id
       LEFT JOIN users pu ON pu.id = sp.parent_id
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
         AND COALESCE(e.enrollment_source, 'manual') IN ('group', 'manual')
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

    const phone = r.parent_phone || r.student_phone;
    if (!phone) {
      skipped.push({ enrollment_id: r.enrollment_id, reason: 'no_phone' });
      continue;
    }

    const msg =
      'Mentorix: Növbəti dərsiniz paketinizin son dərsidir. Davam etmək üçün ödənişi nəzərə alın.';

    if (!dryRun) {
      await sendSms({ instructorId: r.instructor_id, phone, message: msg });
      await db.query(
        `UPDATE enrollments
         SET pack_reminder_sent_cycle = billing_cycle
         WHERE id = $1`,
        [r.enrollment_id]
      );
    }

    sent.push({ enrollment_id: r.enrollment_id, phone, n, billing_cycle: r.billing_cycle, dryRun });
  }

  return { sent, skipped, dryRun };
}

module.exports = { runPackReminders };

