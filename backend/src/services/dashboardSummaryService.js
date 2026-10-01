/**
 * Rol üzrə dashboard xülasəsi: hər rol üçün bir paket, bütün sorğular paralel.
 * Jurnal (student_activity_log) yalnız son 24 saatlıq indeks aralığında və limitlə oxunur; qalan saylar
 * aqreqat/irəliləyiş cədvəllərindəndir. Bir sorğu alınmasa yalnız həmin bənd «əlçatmaz» olur.
 */
const db = require('../utils/db');
const { MATERIAL_ROSTER_SQL, EXAM_ROSTER_SQL } = require('./engagementService');
const rules = require('./dashboardSummaryRules');

const { rowOrNull, hoursAgo, daysAgo, daysAhead } = rules;

async function safe(label, fn) {
  try {
    return await fn();
  } catch (e) {
    console.error('[dashboard-summary]', label, e.message);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Teacher                                                             */
/* ------------------------------------------------------------------ */

/**
 * Material kartlarının cəmi: eyni roster (MATERIAL_ROSTER_SQL), eyni qayda (engagementRules.materialStudentStatus):
 * viewed = first_viewed_at və ya completed_at; overdue = baxmayıb və due_at < now.
 * $1 = instructor_id, $2 = NULL (bütün materiallar), $3 = now
 */
const TEACHER_MATERIALS_SQL = `
  /* dash_teacher_materials */
  SELECT
    COUNT(*) FILTER (WHERE NOT r.viewed)::int AS not_viewed,
    COUNT(DISTINCT r.material_id) FILTER (WHERE NOT r.viewed)::int AS materials_with_unviewed,
    COUNT(*) FILTER (WHERE NOT r.viewed AND cm.due_at < $3)::int AS overdue
  FROM (
    SELECT roster.material_id, (roster.first_viewed_at IS NOT NULL OR roster.completed_at IS NOT NULL) AS viewed
    FROM (${MATERIAL_ROSTER_SQL}) roster
  ) r
  JOIN course_materials cm ON cm.id = r.material_id AND cm.instructor_id = $1`;

/**
 * Tapşırıq kartlarının cəmi: engagementService.assignmentStudents ilə eyni sətirlər və
 * engagementRules.assignmentStudentStatus ilə eyni qayda:
 *   graded  = status <> returned və (status = reviewed və ya reviewed_at + submitted_at)
 *   waiting = returned/graded deyil, submitted_at var, status <> late_rejected   (kartda waiting_grading)
 *   overdue = graded/waiting/returned deyil və son gün (Bakı 23:59:59 = 19:59:59 UTC) keçib
 * $1 = instructor_id, $2 = now
 */
const TEACHER_ASSIGNMENTS_SQL = `
  /* dash_teacher_assignments */
  WITH st AS (
    SELECT sa.assignment_id,
           LOWER(COALESCE(sa.status, '')) AS s,
           sa.submitted_at,
           sa.reviewed_at,
           (a.due_date + TIME '19:59:59') AT TIME ZONE 'UTC' AS due_end
    FROM student_assignments sa
    JOIN assignments a ON a.id = sa.assignment_id AND a.instructor_id = $1
    JOIN users u ON u.id = sa.student_id AND COALESCE(u.is_active, TRUE) = TRUE AND u.deleted_at IS NULL
    WHERE sa.assignment_id = ANY (ARRAY(SELECT x.id FROM assignments x WHERE x.instructor_id = $1))
  ),
  flags AS (
    SELECT assignment_id, due_end,
           (s = 'returned') AS returned,
           (s <> 'returned' AND (s = 'reviewed' OR (reviewed_at IS NOT NULL AND submitted_at IS NOT NULL))) AS graded,
           s, submitted_at
    FROM st
  ),
  status AS (
    SELECT assignment_id, due_end, returned, graded,
           (NOT returned AND NOT graded AND submitted_at IS NOT NULL AND s <> 'late_rejected') AS waiting
    FROM flags
  )
  SELECT
    COUNT(*) FILTER (WHERE waiting)::int AS waiting_grading,
    COUNT(*) FILTER (WHERE NOT graded AND NOT waiting AND NOT returned AND due_end < $2)::int AS overdue,
    COUNT(DISTINCT assignment_id) FILTER (WHERE NOT graded AND NOT waiting AND NOT returned AND due_end < $2)::int
      AS overdue_assignments
  FROM status`;

/**
 * İmtahan kartlarının cəmi: eyni roster (EXAM_ROSTER_SQL; ləğv edilmiş cəhdlər artıq çıxarılıb) və
 * activityStatusRules.examStudentState ilə eyni qayda:
 *   completed      = progress.completed_at və ya son cəhdin submitted_at
 *   pending        = completed və progress.status = pending_manual_grading
 *   auto_submitted = completed və (expired_at və ya status = expired_auto_submitted)
 *   no_answers     = completed deyil və (status = expired_no_answers və ya cəhd status = expired)
 * $1 = instructor_id, $2 = NULL (bütün imtahanlar)
 */
const TEACHER_EXAMS_SQL = `
  /* dash_teacher_exams */
  SELECT
    COUNT(*) FILTER (WHERE x.completed AND x.status = 'pending_manual_grading')::int AS pending_manual_grading,
    COUNT(*) FILTER (WHERE x.completed AND (x.expired_at IS NOT NULL OR x.status = 'expired_auto_submitted'))::int
      AS auto_submitted,
    COUNT(*) FILTER (WHERE NOT x.completed AND (x.status = 'expired_no_answers' OR x.result_status = 'expired'))::int
      AS expired_no_answers
  FROM (
    SELECT r.exam_id, r.status, r.expired_at,
           LOWER(COALESCE(r.result_status, '')) AS result_status,
           (r.completed_at IS NOT NULL OR r.result_submitted_at IS NOT NULL) AS completed
    FROM (${EXAM_ROSTER_SQL}) r
  ) x`;

/** Müəllimə gələn oxunmamış «təqdim etdi» bildirişləri (idx_notifications_user_unread). */
const TEACHER_UNREAD_SUBMISSIONS_SQL = `
  /* dash_teacher_unread_submissions */
  SELECT COUNT(*)::int AS n
  FROM notifications n
  WHERE n.user_id = $1 AND n.is_read = FALSE
    AND LOWER(COALESCE(n.type, '')) ~ $2
    AND NOT (n.meta @> '{"silent": true}'::jsonb)`;

/** Son 24 saat: (instructor_id, created_at DESC) indeks aralığı, ən çox RECENT_ACTIVITY_SCAN_CAP sətir. */
const TEACHER_ACTIVITY_COUNTS_SQL = `
  /* dash_teacher_activity_counts */
  SELECT recent.event_type, COUNT(*)::int AS n
  FROM (
    SELECT l.event_type
    FROM student_activity_log l
    WHERE l.instructor_id = $1 AND l.created_at >= $2 AND l.event_type = ANY($3::text[])
    ORDER BY l.created_at DESC
    LIMIT $4
  ) recent
  GROUP BY recent.event_type`;

/** Obyekt adı yalnız bu müəllimə aid obyektdən götürülür. */
const TEACHER_ACTIVITY_LATEST_SQL = `
  /* dash_teacher_activity_latest */
  SELECT l.event_type, l.entity_type, l.entity_id, l.created_at,
         u.full_name AS student_name,
         COALESCE(cm.title, a.title, e.title) AS entity_title
  FROM (
    SELECT event_type, entity_type, entity_id, student_id, created_at
    FROM student_activity_log
    WHERE instructor_id = $1 AND created_at >= $2 AND event_type = ANY($3::text[])
    ORDER BY created_at DESC
    LIMIT $4
  ) l
  LEFT JOIN users u ON u.id = l.student_id
  LEFT JOIN course_materials cm ON l.entity_type = 'material' AND cm.id = l.entity_id AND cm.instructor_id = $1
  LEFT JOIN assignments a ON l.entity_type = 'assignment' AND a.id = l.entity_id AND a.instructor_id = $1
  LEFT JOIN exams e ON l.entity_type = 'exam' AND e.id = l.entity_id AND e.instructor_id = $1
  ORDER BY l.created_at DESC`;

async function teacherRecentActivity(instructorId, now) {
  const since = hoursAgo(now, rules.RECENT_ACTIVITY_HOURS);
  const [counts, latest] = await Promise.all([
    db.query(TEACHER_ACTIVITY_COUNTS_SQL, [instructorId, since, rules.ACTIVITY_EVENT_TYPES, rules.RECENT_ACTIVITY_SCAN_CAP]),
    db.query(TEACHER_ACTIVITY_LATEST_SQL, [instructorId, since, rules.ACTIVITY_EVENT_TYPES, rules.RECENT_ACTIVITY_LATEST]),
  ]);
  const scanned = counts.rows.reduce((s, r) => s + (Number(r.n) || 0), 0);
  return rules.summarizeRecentActivity(counts.rows, latest.rows, { capped: scanned >= rules.RECENT_ACTIVITY_SCAN_CAP });
}

async function getTeacherSummary(instructorId, { now = new Date() } = {}) {
  const { countPendingJoinRequests } = require('./joinInvitationService');
  const [materials, assignments, exams, unreadSubmissions, joinRequests, activity] = await Promise.all([
    safe('materials', async () => rowOrNull(await db.query(TEACHER_MATERIALS_SQL, [instructorId, null, now]))),
    safe('assignments', async () => rowOrNull(await db.query(TEACHER_ASSIGNMENTS_SQL, [instructorId, now]))),
    safe('exams', async () => rowOrNull(await db.query(TEACHER_EXAMS_SQL, [instructorId, null]))),
    safe('unread_submissions', async () =>
      rowOrNull(await db.query(TEACHER_UNREAD_SUBMISSIONS_SQL, [instructorId, rules.SUBMISSION_NOTIFICATION_TYPE_RE]))?.n ?? 0,
    ),
    safe('join_requests', () => countPendingJoinRequests(instructorId)),
    safe('activity', () => teacherRecentActivity(instructorId, now)),
  ]);
  return rules.buildTeacherSummary(
    { materials, assignments, exams, unreadSubmissions, joinRequests, activity },
    { now },
  );
}

/* ------------------------------------------------------------------ */
/* Student                                                             */
/* ------------------------------------------------------------------ */

/**
 * Tələbəyə təyin olunmuş imtahanlar (exam_assignments.student_id indeksi — migrasiya 224).
 * Bitmə anı: available_until (köhnə imtahanlarda start_time + müddət) və ya fərdi late_access_until — hansı gecdirsə.
 * new = bağlanmayıb və tələbə hələ açmayıb (progress yoxdur / baxılmayıb, cəhd yoxdur).
 * $1 = student, $2 = instructor filtri (NULL = hamısı), $3 = now, $4 = now + 7 gün
 */
const STUDENT_EXAMS_SQL = `
  /* dash_student_exams */
  SELECT
    COUNT(*) FILTER (WHERE x.not_closed AND NOT x.touched)::int AS new_count,
    COUNT(*) FILTER (WHERE x.not_closed AND NOT x.submitted AND x.deadline <= $4)::int AS upcoming,
    MIN(x.deadline) FILTER (WHERE x.not_closed AND NOT x.submitted AND x.deadline <= $4) AS next_deadline
  FROM (
    SELECT d.deadline,
           (d.deadline IS NULL OR d.deadline > $3) AS not_closed,
           (p.viewed_at IS NOT NULL OR p.started_at IS NOT NULL OR lr.id IS NOT NULL) AS touched,
           (lr.submitted_at IS NOT NULL OR p.completed_at IS NOT NULL) AS submitted
    FROM exam_assignments ea
    JOIN exams e ON e.id = ea.exam_id AND COALESCE(e.is_deleted, FALSE) = FALSE
    CROSS JOIN LATERAL (
      SELECT GREATEST(
        COALESCE(e.available_until, e.start_time + make_interval(mins => COALESCE(e.duration_minutes, 0))),
        ea.late_access_until
      ) AS deadline
    ) d
    LEFT JOIN exam_student_progress p ON p.exam_id = ea.exam_id AND p.student_id = ea.student_id
    LEFT JOIN LATERAL (
      SELECT er.id, er.submitted_at
      FROM exam_results er
      WHERE er.exam_id = ea.exam_id AND er.student_id = ea.student_id AND COALESCE(er.status, '') <> 'voided'
      ORDER BY er.submitted_at DESC NULLS LAST
      LIMIT 1
    ) lr ON TRUE
    WHERE ea.student_id = $1 AND ($2::uuid IS NULL OR e.instructor_id = $2)
  ) x`;

/**
 * new = mövcud «görülməmiş tapşırıq» sayı ilə eyni (notificationController.getStudentNotificationSummary).
 * Rəy = son 14 gündə qiymətləndirilib; qaytarılanlar ayrıca (yenidən işləmək lazımdır).
 * $1 = student, $2 = instructor filtri, $3 = now, $4 = now + 7 gün, $5 = now - 14 gün
 */
const STUDENT_ASSIGNMENTS_SQL = `
  /* dash_student_assignments */
  SELECT
    COUNT(*) FILTER (WHERE x.open AND x.seen_at IS NULL)::int AS new_count,
    COUNT(*) FILTER (WHERE (x.open OR x.s = 'returned') AND x.due_end > $3 AND x.due_end <= $4)::int AS upcoming,
    MIN(x.due_end) FILTER (WHERE (x.open OR x.s = 'returned') AND x.due_end > $3 AND x.due_end <= $4) AS next_deadline,
    COUNT(*) FILTER (WHERE x.s = 'returned')::int AS returned,
    COUNT(*) FILTER (
      WHERE x.s <> 'returned' AND x.reviewed_at >= $5 AND (x.s = 'reviewed' OR x.submitted_at IS NOT NULL)
    )::int AS feedback_recent
  FROM (
    SELECT LOWER(COALESCE(sa.status, '')) AS s, sa.seen_at, sa.submitted_at, sa.reviewed_at,
           (a.due_date + TIME '19:59:59') AT TIME ZONE 'UTC' AS due_end,
           (sa.submitted_at IS NULL AND LOWER(COALESCE(sa.status, '')) IN ('pending', 'late')) AS open
    FROM student_assignments sa
    JOIN assignments a ON a.id = sa.assignment_id
    WHERE sa.student_id = $1 AND ($2::uuid IS NULL OR a.instructor_id = $2)
  ) x`;

/**
 * Son 14 gündə paylaşılan, tələbənin hələ açmadığı materiallar.
 * Giriş mənbələri courseMaterialsService.studentCanAccessMaterial ilə eynidir; hər biri tələbədən başlayan indekslə.
 * $1 = student, $2 = instructor filtri, $3 = now - 14 gün
 */
const STUDENT_MATERIALS_SQL = `
  /* dash_student_materials */
  WITH my_groups AS (
    SELECT e.group_id FROM enrollments e
    WHERE e.student_id = $1 AND e.group_id IS NOT NULL
      AND e.status IN ('active', 'pending_setup') AND e.deleted_at IS NULL
    UNION
    SELECT igm.group_id FROM instructor_group_members igm WHERE igm.student_id = $1
  ),
  my_instructors AS (
    SELECT DISTINCT e.instructor_id FROM enrollments e
    WHERE e.student_id = $1 AND e.status IN ('active', 'pending_setup') AND e.deleted_at IS NULL
  ),
  mats AS (
    SELECT cm.id, cm.instructor_id FROM my_groups g JOIN course_materials cm ON cm.group_id = g.group_id
    WHERE cm.created_at >= $3
    UNION
    SELECT cm.id, cm.instructor_id FROM my_groups g
    JOIN course_material_groups cmg ON cmg.group_id = g.group_id
    JOIN course_materials cm ON cm.id = cmg.material_id
    WHERE cm.created_at >= $3
    UNION
    SELECT cm.id, cm.instructor_id FROM course_material_guest_students gs
    JOIN course_materials cm ON cm.id = gs.material_id
    WHERE gs.student_id = $1 AND cm.created_at >= $3
    UNION
    SELECT cm.id, cm.instructor_id FROM student_assignments sa
    JOIN course_materials cm ON cm.assignment_id = sa.assignment_id
    WHERE sa.student_id = $1 AND cm.created_at >= $3
    UNION
    SELECT cm.id, cm.instructor_id FROM student_assignments sa
    JOIN assignment_material_links aml ON aml.assignment_id = sa.assignment_id
    JOIN course_materials cm ON cm.id = aml.material_id
    WHERE sa.student_id = $1 AND cm.created_at >= $3
    UNION
    SELECT cm.id, cm.instructor_id FROM my_instructors mi JOIN course_materials cm ON cm.instructor_id = mi.instructor_id
    WHERE cm.group_id IS NULL AND cm.assignment_id IS NULL AND cm.created_at >= $3
      AND NOT EXISTS (SELECT 1 FROM course_material_groups x WHERE x.material_id = cm.id)
  )
  SELECT COUNT(*)::int AS new_count
  FROM mats
  LEFT JOIN material_assignments ma ON ma.material_id = mats.id AND ma.student_id = $1
  WHERE ($2::uuid IS NULL OR mats.instructor_id = $2)
    AND ma.first_opened_at IS NULL AND ma.first_viewed_at IS NULL AND COALESCE(ma.download_count, 0) = 0`;

/** Son 14 gündə açıqlanan nəticələr (exam_student_progress.student_id indeksi). */
const STUDENT_RESULTS_SQL = `
  /* dash_student_results */
  SELECT COUNT(*)::int AS released, MAX(p.result_released_at) AS latest_at
  FROM exam_student_progress p
  JOIN exams e ON e.id = p.exam_id AND COALESCE(e.is_deleted, FALSE) = FALSE
  WHERE p.student_id = $1 AND p.result_released_at >= $3 AND ($2::uuid IS NULL OR e.instructor_id = $2)`;

/** Qoşulma sorğuları: gözləyənlər + son 14 gündə həll olunanlar (tələbənin öz enrollment-ləri üzərindən). */
const STUDENT_JOIN_SQL = `
  /* dash_student_join */
  SELECT CASE UPPER(TRIM(sjr.status)) WHEN 'PENDING' THEN 'pending' WHEN 'APPROVED' THEN 'approved' ELSE 'rejected' END AS status,
         ig.name AS group_name,
         COALESCE(sjr.resolved_at, sjr.created_at) AS at
  FROM enrollments e
  JOIN student_join_requests sjr ON sjr.enrollment_id = e.id AND sjr.student_id = $1
  LEFT JOIN instructor_groups ig ON ig.id = sjr.group_id
  WHERE e.student_id = $1
    AND (
      (UPPER(TRIM(sjr.status)) = 'PENDING' AND e.deleted_at IS NULL
        AND COALESCE(LOWER(TRIM(e.status)), '') = 'pending_approval')
      OR (UPPER(TRIM(sjr.status)) IN ('APPROVED', 'REJECTED') AND sjr.resolved_at >= $2)
    )
  ORDER BY at DESC
  LIMIT 10`;

async function getStudentSummary(studentId, { instructorId = null, now = new Date() } = {}) {
  const scope = instructorId || null;
  const [exams, assignments, materials, results, join] = await Promise.all([
    safe('student_exams', async () =>
      rowOrNull(await db.query(STUDENT_EXAMS_SQL, [studentId, scope, now, daysAhead(now, rules.UPCOMING_DEADLINE_DAYS)])),
    ),
    safe('student_assignments', async () =>
      rowOrNull(
        await db.query(STUDENT_ASSIGNMENTS_SQL, [
          studentId,
          scope,
          now,
          daysAhead(now, rules.UPCOMING_DEADLINE_DAYS),
          daysAgo(now, rules.FEEDBACK_DAYS),
        ]),
      ),
    ),
    safe('student_materials', async () =>
      rowOrNull(await db.query(STUDENT_MATERIALS_SQL, [studentId, scope, daysAgo(now, rules.NEW_ITEM_DAYS)])),
    ),
    safe('student_results', async () =>
      rowOrNull(await db.query(STUDENT_RESULTS_SQL, [studentId, scope, daysAgo(now, rules.RECENT_RESULT_DAYS)])),
    ),
    safe('student_join', async () =>
      (await db.query(STUDENT_JOIN_SQL, [studentId, daysAgo(now, rules.JOIN_RESOLVED_DAYS)])).rows,
    ),
  ]);
  return rules.buildStudentSummary({ exams, assignments, materials, results, join }, { now });
}

/* ------------------------------------------------------------------ */
/* Admin (aggregate only)                                              */
/* ------------------------------------------------------------------ */

const ADMIN_SECURITY_SQL = `
  /* dash_admin_security */
  SELECT
    (SELECT COUNT(*)::int FROM notifications n
      WHERE n.user_id = $1 AND n.is_read = FALSE
        AND (n.category = 'security' OR (n.category IS NULL AND n.type = ANY($2::text[])))) AS unread_notifications,
    (SELECT COUNT(*)::int FROM auth_events a WHERE a.event = ANY($3::text[]) AND a.created_at >= $4) AS auth_failures`;

const ADMIN_PARTNERS_SQL = `
  /* dash_admin_partners */
  SELECT COUNT(*)::int AS pending, MIN(created_at) AS oldest_at FROM partners WHERE status = 'pending'`;

/** idx_notification_queue_failed (failed_at DESC) WHERE status = 'failed'. failed_at olmayan köhnə sətirlər sayılmır. */
const ADMIN_DELIVERIES_SQL = `
  /* dash_admin_deliveries */
  SELECT COUNT(*) FILTER (WHERE failed_at >= $1)::int AS last_24h, COUNT(*)::int AS last_7d
  FROM notification_queue
  WHERE status = 'failed' AND channel = 'email' AND failed_at >= $2`;

/** Yeganə iş-xətası mənbəyi: AI açıq sual yoxlama növbəsi (openExamGradingWorker status = 'error'). */
const ADMIN_JOBS_SQL = `
  /* dash_admin_jobs */
  SELECT COUNT(*)::int AS open_grading_failed
  FROM exam_open_grading_queue
  WHERE status = 'error' AND processed_at >= $1`;

const ADMIN_COMMISSIONS_SQL = `
  /* dash_admin_commissions */
  SELECT
    (SELECT COUNT(*)::int FROM partner_payouts WHERE status = 'pending') AS pending_payouts,
    (SELECT COALESCE(SUM(amount_cents), 0)::bigint FROM partner_payouts WHERE status = 'pending') AS pending_payout_cents,
    (SELECT COUNT(*)::int FROM partner_commissions WHERE status = 'pending') AS pending_commissions`;

async function getAdminSummary(adminId, { now = new Date() } = {}) {
  const [security, partners, deliveries, jobs, commissions] = await Promise.all([
    safe('admin_security', async () =>
      rowOrNull(
        await db.query(ADMIN_SECURITY_SQL, [
          adminId,
          rules.SECURITY_NOTIFICATION_TYPES,
          rules.AUTH_FAILURE_EVENTS,
          hoursAgo(now, rules.AUTH_FAILURE_HOURS),
        ]),
      ),
    ),
    safe('admin_partners', async () => rowOrNull(await db.query(ADMIN_PARTNERS_SQL))),
    safe('admin_deliveries', async () =>
      rowOrNull(
        await db.query(ADMIN_DELIVERIES_SQL, [
          hoursAgo(now, rules.FAILED_DELIVERY_WINDOWS_HOURS.day),
          hoursAgo(now, rules.FAILED_DELIVERY_WINDOWS_HOURS.week),
        ]),
      ),
    ),
    safe('admin_jobs', async () => rowOrNull(await db.query(ADMIN_JOBS_SQL, [daysAgo(now, rules.JOB_FAILURE_DAYS)]))),
    safe('admin_commissions', async () => rowOrNull(await db.query(ADMIN_COMMISSIONS_SQL))),
  ]);
  return rules.buildAdminSummary({ security, partners, deliveries, jobs, commissions }, { now });
}

/**
 * /admin/operations səhifəsi: uğursuz girişlər (səbəb üzrə), uğursuz email-lər, uğursuz fon işləri.
 * Ünvan, mövzu, mətn, IP, email və istifadəçi ID-si qaytarılmır.
 */
async function getAdminOperations({ now = new Date() } = {}) {
  const queue = require('./notificationQueueService');
  const [authFailures, emailSummary, emailRecent, jobFailures] = await Promise.all([
    safe('ops_auth', async () =>
      (
        await db.query(
          `/* ops_auth_failures */
           SELECT a.event, COALESCE(a.metadata->>'reason', a.metadata->>'stage', a.metadata->>'endpoint', 'unknown') AS reason,
                  COUNT(*)::int AS count, MAX(a.created_at) AS last_at
           FROM auth_events a
           WHERE a.event = ANY($1::text[]) AND a.created_at >= $2
           GROUP BY 1, 2
           ORDER BY count DESC
           LIMIT 20`,
          [rules.AUTH_FAILURE_EVENTS, hoursAgo(now, rules.AUTH_FAILURE_HOURS)],
        )
      ).rows,
    ),
    safe('ops_email_summary', () => queue.failedEmailDeliverySummary({ sinceHours: rules.FAILED_DELIVERY_WINDOWS_HOURS.week })),
    safe('ops_email_recent', async () =>
      (await queue.listFailedEmailDeliveries({ sinceHours: rules.FAILED_DELIVERY_WINDOWS_HOURS.week, limit: 50 })).map((r) => ({
        id: r.id,
        event_type: r.event_type || null,
        template_key: r.template_key || null,
        locale: r.locale || null,
        provider: r.provider || null,
        error_code: r.error_code || null,
        error_message_safe: r.error_message_safe || null,
        retry_count: Number(r.retry_count) || 0,
        failed_at: r.failed_at || null,
      })),
    ),
    safe('ops_jobs', async () =>
      (
        await db.query(
          `/* ops_job_failures */
           SELECT q.id, q.created_at, q.processed_at, LEFT(COALESCE(q.last_error, ''), 160) AS error
           FROM exam_open_grading_queue q
           WHERE q.status = 'error' AND q.processed_at >= $1
           ORDER BY q.processed_at DESC
           LIMIT 50`,
          [daysAgo(now, rules.JOB_FAILURE_DAYS)],
        )
      ).rows,
    ),
  ]);
  return {
    generated_at: now.toISOString(),
    security: authFailures == null ? null : { window_hours: rules.AUTH_FAILURE_HOURS, groups: authFailures },
    email: emailSummary == null && emailRecent == null ? null : { summary: emailSummary, recent: emailRecent || [] },
    jobs:
      jobFailures == null
        ? null
        : { window_days: rules.JOB_FAILURE_DAYS, source: 'exam_open_grading_queue', recent: jobFailures },
    omitted: rules.ADMIN_OMITTED,
  };
}

module.exports = {
  getTeacherSummary,
  getStudentSummary,
  getAdminSummary,
  getAdminOperations,
  TEACHER_MATERIALS_SQL,
  TEACHER_ASSIGNMENTS_SQL,
  TEACHER_EXAMS_SQL,
  TEACHER_UNREAD_SUBMISSIONS_SQL,
  TEACHER_ACTIVITY_COUNTS_SQL,
  TEACHER_ACTIVITY_LATEST_SQL,
  STUDENT_EXAMS_SQL,
  STUDENT_ASSIGNMENTS_SQL,
  STUDENT_MATERIALS_SQL,
  STUDENT_RESULTS_SQL,
  STUDENT_JOIN_SQL,
  ADMIN_SECURITY_SQL,
  ADMIN_PARTNERS_SQL,
  ADMIN_DELIVERIES_SQL,
  ADMIN_JOBS_SQL,
  ADMIN_COMMISSIONS_SQL,
};
