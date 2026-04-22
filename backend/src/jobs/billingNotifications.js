const db = require('../utils/db');
const { computeMonthlyCycleProgress, getTodayBakuYmd, toYmd } = require('../services/subscriptionBilling');

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

async function runMonthlyTwoDayNotifications() {
  const todayBaku = await getTodayBakuYmd(db);
  const { rows } = await db.query(
    `SELECT e.id AS enrollment_id, e.instructor_id, e.student_id, e.enrollment_start_date
     FROM enrollments e
     WHERE e.billing_type = 'monthly'
       AND (e.status IS NULL OR LOWER(TRIM(e.status)) = 'active')`
  );

  let sent = 0;
  for (const r of rows) {
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
         lesson_date,
         to_char((lesson_date AT TIME ZONE 'Asia/Baku')::date, 'YYYY-MM-DD') AS ymd,
         EXTRACT(ISODOW FROM (lesson_date AT TIME ZONE 'Asia/Baku'))::int AS dow
       FROM lessons
       WHERE enrollment_id = $1 AND billing_cycle = $3
     ),
     sched AS (
       SELECT
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
       COUNT(*) FILTER (WHERE scheduled_ts <= NOW())::int AS used
     FROM sched`,
    [enrollmentId, lt, cycle]
  );

  const total = Number(agg[0]?.total ?? 0) || 0;
  const used = Math.min(total, Math.max(0, Number(agg[0]?.used ?? 0) || 0));
  return Math.max(0, total - used);
}

async function runLessonPackLastLessonNotifications() {
  const { rows } = await db.query(
    `SELECT id AS enrollment_id, instructor_id, student_id, billing_type, billing_cycle
     FROM enrollments
     WHERE billing_type IN ('8_lessons','12_lessons')
       AND (status IS NULL OR LOWER(TRIM(status)) = 'active')`
  );

  let sent = 0;
  for (const r of rows) {
    const cycle = Number(r.billing_cycle || 1) || 1;
    const remaining = await remainingLessonsCalendar(r.enrollment_id, cycle);
    if (remaining !== 1) continue;

    const a = await ensureNotificationOnce({
      user_id: r.student_id,
      type: 'billing_pkg_last_lesson_student',
      title: 'Paket bitir',
      body: BILLING_MESSAGE,
    });
    if (a) sent += 1;

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

