const db = require('../utils/db');
const { computeMonthlyCycleProgress, getTodayBakuYmd, toYmd } = require('../services/subscriptionBilling');
const { SQL_EXCLUDE_SYSTEM_GROUP_ENROLLMENTS } = require('../services/systemGroupGuards');
const { notifyBillingOnce } = require('../services/billingNotifications');

const BILLING_MESSAGE =
  'Hörmətli tələbə, aylıq abunəliyinizin bitməsinə 2 gün qalıb. Davam etmək üçün ödənişi yeniləməyiniz xahiş olunur.';

async function runMonthlyTwoDayNotifications() {
  const todayBaku = await getTodayBakuYmd(db);
  const { rows } = await db.query(
    `SELECT e.id AS enrollment_id, e.instructor_id, e.student_id, e.enrollment_start_date,
            COALESCE(e.notifications_enabled, TRUE) AS notifications_enabled
     FROM enrollments e
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

    const monthlyKey = `billing_monthly_2d:${r.enrollment_id}:${prog.cycle_end_ymd || todayBaku}`;
    const a = await notifyBillingOnce({
      userId: r.student_id,
      type: 'billing_monthly_2d_student',
      title: 'Abunəlik bitir',
      body: BILLING_MESSAGE,
      priority: 'HIGH',
      meta: { enrollment_id: r.enrollment_id },
      providerWorkspaceId: r.instructor_id || null,
      dedupeKey: monthlyKey,
      email: true,
    });
    if (a) sent += 1;

    if (r.instructor_id) {
      const b = await notifyBillingOnce({
        userId: r.instructor_id,
        type: 'billing_monthly_2d_instructor',
        title: 'Abunəlik bitir',
        body: BILLING_MESSAGE,
        meta: { enrollment_id: r.enrollment_id, student_id: r.student_id },
        providerWorkspaceId: r.instructor_id,
        dedupeKey: monthlyKey,
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
            COALESCE(e.notifications_enabled, TRUE) AS notifications_enabled
     FROM enrollments e
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

    const packKey = `billing_pkg_last_lesson:${r.enrollment_id}:${cycle}`;
    const a = await notifyBillingOnce({
      userId: r.student_id,
      type: 'billing_pkg_last_lesson_student',
      title: 'Paket bitir',
      body: BILLING_MESSAGE,
      priority: 'HIGH',
      meta: { enrollment_id: r.enrollment_id, billing_cycle: cycle },
      providerWorkspaceId: r.instructor_id || null,
      dedupeKey: packKey,
      email: true,
    });
    if (a) sent += 1;

    if (r.instructor_id) {
      const b = await notifyBillingOnce({
        userId: r.instructor_id,
        type: 'billing_pkg_last_lesson_instructor',
        title: 'Paket bitir',
        body: BILLING_MESSAGE,
        meta: { enrollment_id: r.enrollment_id, student_id: r.student_id, billing_cycle: cycle },
        providerWorkspaceId: r.instructor_id,
        dedupeKey: packKey,
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

