const db = require('../utils/db');
const { computeMonthlyCycleProgress, getTodayBakuYmd, toYmd } = require('../services/subscriptionBilling');
const { sendSms } = require('../services/smsService');
const { SQL_EXCLUDE_SYSTEM_GROUP_ENROLLMENTS } = require('../services/systemGroupGuards');

async function ensureNotificationOnce({ user_id, type, title, body }) {
  const { rows } = await db.query(
    `SELECT 1 FROM notifications
     WHERE user_id = $1
       AND type = $2
       AND body = $3
       AND created_at > NOW() - INTERVAL '45 days'
     LIMIT 1`,
    [user_id, type, body]
  );
  if (rows.length) return false;
  await db.query(
    `INSERT INTO notifications (user_id, title, body, type, is_read)
     VALUES ($1,$2,$3,$4,FALSE)`,
    [user_id, title, body, type]
  );
  return true;
}

const BILLING_MESSAGE =
  'Hörmətli tələbə, aylıq abunəliyinizin bitməsinə 2 gün qalıb. Davam etmək üçün ödənişi yeniləməyiniz xahiş olunur.';

async function ensureSmsOnce({ instructor_id, phone, message, type }) {
  const p = String(phone ?? '').trim();
  if (!p) return false;
  const msg = String(message ?? '').trim();
  if (!msg) return false;
  const kind = String(type ?? 'billing').slice(0, 50);

  const { rows } = await db.query(
    `SELECT 1 FROM sms_logs
     WHERE phone = $1
       AND message = $2
       AND (type = $3 OR status = $3)
       AND sent_at > NOW() - INTERVAL '45 days'
     LIMIT 1`,
    [p, msg, kind]
  );
  if (rows.length) return false;

  const result = await sendSms({
    instructorId: instructor_id || null,
    phone: p,
    message: msg,
  });

  if (result.success) {
    try {
      await db.query(
        `UPDATE sms_logs SET type = $3 WHERE instructor_id = $1 AND phone = $2 AND message = $4
         AND COALESCE(created_at, sent_at) > NOW() - INTERVAL '2 minutes'`,
        [instructor_id || null, p, kind, msg],
      );
    } catch {
      // type column optional
    }
  }

  return result.success === true;
}

async function runMonthlyTwoDayNotifications() {
  const todayBaku = await getTodayBakuYmd(db);
  const { rows } = await db.query(
    `SELECT e.id AS enrollment_id, e.instructor_id, e.student_id, e.enrollment_start_date,
            COALESCE(e.notifications_enabled, TRUE) AS notifications_enabled,
            su.phone AS student_phone,
            sp.parent_phone
     FROM enrollments e
     LEFT JOIN users su ON su.id = e.student_id
     LEFT JOIN student_profiles sp ON sp.user_id = e.student_id
     WHERE e.billing_type = 'monthly'
       AND (e.status IS NULL OR LOWER(TRIM(e.status)) = 'active')
       ${SQL_EXCLUDE_SYSTEM_GROUP_ENROLLMENTS}`
  );

  let sent = 0;
  for (const r of rows) {
    if (!r.notifications_enabled) continue;
    const anchorYmd = toYmd(r.enrollment_start_date);
    if (!anchorYmd) continue;
    const prog = computeMonthlyCycleProgress({ anchor_ymd: anchorYmd, today_ymd: todayBaku });
    if (prog?.days_remaining !== 2) continue;

    const a = await ensureNotificationOnce({
      user_id: r.student_id,
      type: 'billing_monthly_2d_student',
      title: 'Abunəlik bitir',
      body: BILLING_MESSAGE,
    });
    if (a) sent += 1;

    // SMS to student + parent (if exists)
    await ensureSmsOnce({
      instructor_id: r.instructor_id,
      phone: r.student_phone,
      message: BILLING_MESSAGE,
      type: 'billing_monthly_2d',
    });
    await ensureSmsOnce({
      instructor_id: r.instructor_id,
      phone: r.parent_phone,
      message: BILLING_MESSAGE,
      type: 'billing_monthly_2d',
    });

    if (r.instructor_id) {
      const b = await ensureNotificationOnce({
        user_id: r.instructor_id,
        type: 'billing_monthly_2d_instructor',
        title: 'Abunəlik bitir',
        body: BILLING_MESSAGE,
      });
      if (b) sent += 1;
    }
  }
  return { checked: rows.length, sent };
}

async function nextLessonMeta(enrollmentId, cycle) {
  const { rows } = await db.query(
    `WITH enr AS (
       SELECT id, lesson_times
       FROM enrollments
       WHERE id = $1
     ),
     l AS (
       SELECT
         lesson_date,
         to_char((lesson_date AT TIME ZONE 'Asia/Baku')::date, 'YYYY-MM-DD') AS ymd,
         EXTRACT(ISODOW FROM (lesson_date AT TIME ZONE 'Asia/Baku'))::int AS dow
       FROM lessons
       WHERE enrollment_id = $1
         AND billing_cycle = $2
         AND status = 'pending'
     ),
     sched AS (
       SELECT
         l.ymd,
         (
           (l.ymd || ' ' ||
             COALESCE(
               NULLIF(LEFT((enr.lesson_times ->> l.dow::text), 5), ''),
               to_char((l.lesson_date AT TIME ZONE 'Asia/Baku')::time, 'HH24:MI')
             ) || ':00'
           )::timestamp AT TIME ZONE 'Asia/Baku'
         ) AS scheduled_ts
       FROM l
       CROSS JOIN enr
     )
     SELECT ymd, scheduled_ts
     FROM sched
     WHERE scheduled_ts > NOW()
     ORDER BY scheduled_ts
     LIMIT 1`,
    [enrollmentId, cycle]
  );
  return rows[0] || null;
}

async function remainingLessonsCalendar(enrollmentId, cycle) {
  const { rows: enRows } = await db.query(`SELECT lesson_times FROM enrollments WHERE id = $1`, [enrollmentId]);
  const lt = enRows[0]?.lesson_times ?? null;
  if (!lt) return null;

  const { rows: agg } = await db.query(
    `WITH enr AS (
       SELECT $1::uuid AS id, $2::jsonb AS lesson_times
     ),
     l AS (
       SELECT
         status,
         lesson_date,
         to_char((lesson_date AT TIME ZONE 'Asia/Baku')::date, 'YYYY-MM-DD') AS ymd,
         EXTRACT(ISODOW FROM (lesson_date AT TIME ZONE 'Asia/Baku'))::int AS dow
       FROM lessons
       WHERE enrollment_id = $1 AND billing_cycle = $3
     ),
     sched AS (
       SELECT
         l.status,
         (
           (l.ymd || ' ' ||
             COALESCE(
               NULLIF(LEFT((enr.lesson_times ->> l.dow::text), 5), ''),
               to_char((l.lesson_date AT TIME ZONE 'Asia/Baku')::time, 'HH24:MI')
             ) || ':00'
           )::timestamp AT TIME ZONE 'Asia/Baku'
         ) AS scheduled_ts
       FROM l
       CROSS JOIN enr
     )
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE scheduled_ts <= NOW() AND status = 'done')::int AS used
     FROM sched`,
    [enrollmentId, lt, cycle]
  );

  const total = Number(agg[0]?.total ?? 0) || 0;
  const used = Math.min(total, Math.max(0, Number(agg[0]?.used ?? 0) || 0));
  return Math.max(0, total - used);
}

async function runLessonPackLastLessonNotifications() {
  const todayBaku = await getTodayBakuYmd(db);
  const { rows } = await db.query(
    `SELECT e.id AS enrollment_id, e.instructor_id, e.student_id, e.billing_type, e.billing_cycle,
            COALESCE(e.notifications_enabled, TRUE) AS notifications_enabled,
            su.phone AS student_phone,
            sp.parent_phone
     FROM enrollments e
     LEFT JOIN users su ON su.id = e.student_id
     LEFT JOIN student_profiles sp ON sp.user_id = e.student_id
     WHERE e.billing_type IN ('8_lessons','12_lessons')
       AND (e.status IS NULL OR LOWER(TRIM(e.status)) = 'active')
       ${SQL_EXCLUDE_SYSTEM_GROUP_ENROLLMENTS}`
  );

  let sent = 0;
  for (const r of rows) {
    if (!r.notifications_enabled) continue;
    const cycle = Number(r.billing_cycle || 1) || 1;
    const remaining = await remainingLessonsCalendar(r.enrollment_id, cycle);
    if (remaining !== 1) continue; // last lesson remains (upcoming)

    // Trigger: 1 day before last lesson date (calendar day in Baku)
    const nl = await nextLessonMeta(r.enrollment_id, cycle);
    const nextYmd = nl?.ymd ? String(nl.ymd).slice(0, 10) : null;
    if (!nextYmd) continue;
    // YYYY-MM-DD compare using UTC noon conversion
    const dayDiff = Math.round(
      (new Date(`${nextYmd}T12:00:00Z`).getTime() - new Date(`${todayBaku}T12:00:00Z`).getTime()) / 86400000
    );
    if (dayDiff !== 1) continue;

    const a = await ensureNotificationOnce({
      user_id: r.student_id,
      type: 'billing_pkg_last_lesson_student',
      title: 'Paket bitir',
      body: BILLING_MESSAGE,
    });
    if (a) sent += 1;

    await ensureSmsOnce({
      instructor_id: r.instructor_id,
      phone: r.student_phone,
      message: BILLING_MESSAGE,
      type: 'billing_pkg_last_lesson',
    });
    await ensureSmsOnce({
      instructor_id: r.instructor_id,
      phone: r.parent_phone,
      message: BILLING_MESSAGE,
      type: 'billing_pkg_last_lesson',
    });

    if (r.instructor_id) {
      const b = await ensureNotificationOnce({
        user_id: r.instructor_id,
        type: 'billing_pkg_last_lesson_instructor',
        title: 'Paket bitir',
        body: BILLING_MESSAGE,
      });
      if (b) sent += 1;
    }
  }

  return { checked: rows.length, sent };
}

async function runBillingNotifications() {
  const monthly = await runMonthlyTwoDayNotifications();
  const packs = await runLessonPackLastLessonNotifications();
  return { monthly, packs };
}

module.exports = { runBillingNotifications };

