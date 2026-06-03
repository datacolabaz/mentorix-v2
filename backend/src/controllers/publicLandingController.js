const db = require('../utils/db');

function clampInt(n, fallback, min, max) {
  const x = parseInt(String(n), 10);
  if (!Number.isFinite(x)) return fallback;
  return Math.min(max, Math.max(min, x));
}

function pctUplift(prevRate, currRate) {
  const p = Number(prevRate);
  const c = Number(currRate);
  if (!Number.isFinite(p) || !Number.isFinite(c) || p <= 0) return null;
  const raw = ((c - p) / p) * 100;
  if (!Number.isFinite(raw)) return null;
  return Math.round(raw);
}

const { ACTIVE_ENROLLMENT_JOIN_INLINE } = require('../sql/activeEnrollments');

/**
 * Anon marketing snapshot for landing (no auth).
 * - students_managed / instructor_count aktiv qeydiyyatlar üzrə
 * - attendance uplift: işlənmiş dərs qeydlərində iştirak faizi — əvvəlki 30 gün vs son 30 gün (Asia/Baku gün təqvimi)
 */
const getLandingStats = async (req, res) => {
  try {
    const topLimit = clampInt(req.query.top, 0, 0, 12);

    const queries = [
      db.query(
        `SELECT
           COUNT(DISTINCT e.student_id)::int AS students_managed,
           COUNT(DISTINCT e.instructor_id)::int AS instructor_count
         FROM enrollments e
         ${ACTIVE_ENROLLMENT_JOIN_INLINE}`
      ),
      db.query(
        `WITH marked AS (
           SELECT
             e.instructor_id,
             el.starts_at::date AS day,
             CASE WHEN el.status = 'done' THEN 1 ELSE 0 END AS present,
             CASE WHEN el.status = 'absent' THEN 1 ELSE 0 END AS absent
           FROM enrollment_lessons el
           JOIN enrollments e ON e.id = el.enrollment_id
           ${ACTIVE_ENROLLMENT_JOIN_INLINE}
             AND el.status IN ('done','absent')

           UNION ALL

           SELECT
             e.instructor_id,
             mas.lesson_date AS day,
             CASE WHEN mas.status = 'attended' THEN 1 ELSE 0 END AS present,
             CASE WHEN mas.status = 'absent' THEN 1 ELSE 0 END AS absent
           FROM monthly_attendance_slots mas
           JOIN enrollments e ON e.id = mas.enrollment_id
           ${ACTIVE_ENROLLMENT_JOIN_INLINE}
             AND mas.status IN ('attended','absent')
         ),
         agg AS (
           SELECT
             SUM(CASE WHEN day >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Baku')::date - INTERVAL '60 days'
                      AND day <  (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Baku')::date - INTERVAL '30 days'
                 THEN present ELSE 0 END)::int AS p_prev,
             SUM(CASE WHEN day >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Baku')::date - INTERVAL '60 days'
                      AND day <  (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Baku')::date - INTERVAL '30 days'
                 THEN absent ELSE 0 END)::int AS a_prev,
             SUM(CASE WHEN day >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Baku')::date - INTERVAL '30 days'
                      AND day <= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Baku')::date
                 THEN present ELSE 0 END)::int AS p_cur,
             SUM(CASE WHEN day >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Baku')::date - INTERVAL '30 days'
                      AND day <= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Baku')::date
                 THEN absent ELSE 0 END)::int AS a_cur
           FROM marked
         )
         SELECT p_prev, a_prev, p_cur, a_cur FROM agg`
      ),
    ]

    if (topLimit > 0) {
      queries.push(
        db.query(
          `WITH active AS (
             SELECT
               e.instructor_id,
               COUNT(DISTINCT e.student_id)::int AS active_students
             FROM enrollments e
             ${ACTIVE_ENROLLMENT_JOIN_INLINE}
             GROUP BY e.instructor_id
           ),
           marked AS (
             SELECT
               e.instructor_id,
               CASE WHEN el.status = 'done' THEN 1 ELSE 0 END AS present,
               CASE WHEN el.status = 'absent' THEN 1 ELSE 0 END AS absent
             FROM enrollment_lessons el
             JOIN enrollments e ON e.id = el.enrollment_id
             ${ACTIVE_ENROLLMENT_JOIN_INLINE}
               AND el.starts_at >= NOW() - INTERVAL '180 days'
               AND el.status IN ('done','absent')

             UNION ALL

             SELECT
               e.instructor_id,
               CASE WHEN mas.status = 'attended' THEN 1 ELSE 0 END AS present,
               CASE WHEN mas.status = 'absent' THEN 1 ELSE 0 END AS absent
             FROM monthly_attendance_slots mas
             JOIN enrollments e ON e.id = mas.enrollment_id
             ${ACTIVE_ENROLLMENT_JOIN_INLINE}
               AND mas.lesson_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Baku')::date - INTERVAL '180 days'
               AND mas.status IN ('attended','absent')
           ),
           att AS (
             SELECT
               instructor_id,
               SUM(present)::int AS present_n,
               (SUM(present) + SUM(absent))::int AS decided_n,
               CASE WHEN (SUM(present) + SUM(absent)) > 0
                    THEN ROUND(100.0 * SUM(present) / NULLIF(SUM(present) + SUM(absent), 0))
                    ELSE NULL
               END AS attendance_percent
             FROM marked
             GROUP BY instructor_id
           )
           SELECT
             iu.id,
             COALESCE(
               NULLIF(TRIM(iu.full_name), ''),
               NULLIF(TRIM(ip.public_label), ''),
               'Müəllim'
             ) AS display_name,
             COALESCE(a.active_students, 0) AS student_count,
             att.attendance_percent AS attendance_percent,
             COALESCE(att.decided_n, 0)::int AS decided_lessons_180d
           FROM active a
           JOIN users iu ON iu.id = a.instructor_id
           LEFT JOIN instructor_profiles ip ON ip.user_id = iu.id
           LEFT JOIN att ON att.instructor_id = iu.id
           ORDER BY a.active_students DESC,
                    COALESCE(att.attendance_percent, 0) DESC,
                    COALESCE(att.decided_n, 0) DESC,
                    iu.created_at ASC NULLS LAST
           LIMIT $1`,
          [topLimit]
        )
      )
    }

    const results = await Promise.all(queries)
    const totRows = results[0].rows
    const upliftRows = results[1].rows
    const topRows = topLimit > 0 ? results[2].rows : []

    const totals = totRows[0] || { students_managed: 0, instructor_count: 0 };

    const u = upliftRows[0] || {};
    const prevDenom = Number(u.p_prev || 0) + Number(u.a_prev || 0);
    const currDenom = Number(u.p_cur || 0) + Number(u.a_cur || 0);
    const prevRate = prevDenom > 0 ? Number(u.p_prev || 0) / prevDenom : null;
    const currRate = currDenom > 0 ? Number(u.p_cur || 0) / currDenom : null;

    const attendanceUpliftPercent =
      prevDenom >= 12 && currDenom >= 12 ? pctUplift(prevRate, currRate) : null;

    const top_instructors = (topRows || []).map((r) => {
      const pct = r.attendance_percent == null ? null : Number(r.attendance_percent);
      const decided = Number(r.decided_lessons_180d) || 0;
      const stars =
        pct != null && Number.isFinite(pct) && decided > 0
          ? Math.min(5, Math.max(0, Math.round((pct / 100) * 10) / 2))
          : null;
      return {
        id: r.id,
        display_name: r.display_name || 'Müəllim',
        student_count: Number(r.student_count) || 0,
        attendance_percent: pct,
        rating_stars: stars,
      };
    });

    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json({
      success: true,
      stats: {
        students_managed: Number(totals.students_managed) || 0,
        instructor_count: Number(totals.instructor_count) || 0,
        attendance_uplift_percent: attendanceUpliftPercent,
        attendance_wind