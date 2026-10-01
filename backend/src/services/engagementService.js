const crypto = require('crypto');
const db = require('../utils/db');
const {
  materialKind,
  interpretMaterialEvent,
  materialStudentStatus,
  assignmentStudentStatus,
  summarizeMaterial,
  summarizeAssignment,
  assignmentDueEnd,
} = require('./engagementRules');
const { logActivityEvent } = require('./activityProgressService');
const { examStudentState, summarizeExam, EXAM_INACTIVE_AFTER_MINUTES, ACTIVITY_EVENTS } = require('./activityStatusRules');
const {
  parseReportQuery,
  applyReportQuery,
  enrichReportRow,
  earliestIso,
  reminderEligibleFor,
  REMINDER_NOTIFICATION_TYPES,
  reminderMessage,
  reminderMeta,
  planReminderRecipients,
  previewMessages,
  sanitizeTimelineEvent,
} = require('./activityReportRules');
const { deliverReminderNotification } = require('./reminderDelivery');

/** Eyni tələbəyə eyni material/tapşırıq üçün bu müddətdə ikinci xatırlatma getmir. */
const REMINDER_COOLDOWN_HOURS = 6;

function httpError(status, message) {
  const err = new Error(message);
  err.statusCode = status;
  return err;
}

/**
 * Material → onu görməli olan tələbələr (courseMaterialsService.studentCanAccessMaterial ilə eyni mənbələr).
 * $1 = instructor_id, $2 = material id-ləri (NULL = hamısı)
 */
const MATERIAL_ROSTER_SQL = `
  WITH mats AS (
    SELECT cm.id, cm.instructor_id, cm.group_id, cm.assignment_id
    FROM course_materials cm
    WHERE cm.instructor_id = $1 AND ($2::uuid[] IS NULL OR cm.id = ANY($2::uuid[]))
  ),
  mat_groups AS (
    SELECT cmg.material_id, cmg.group_id FROM course_material_groups cmg JOIN mats m ON m.id = cmg.material_id
    UNION
    SELECT m.id, m.group_id FROM mats m WHERE m.group_id IS NOT NULL
  ),
  roster_raw AS (
    SELECT mg.material_id, e.student_id, mg.group_id
    FROM mat_groups mg
    JOIN enrollments e ON e.group_id = mg.group_id
     AND e.status IN ('active', 'pending_setup') AND e.deleted_at IS NULL
    UNION ALL
    SELECT mg.material_id, igm.student_id, mg.group_id
    FROM mat_groups mg JOIN instructor_group_members igm ON igm.group_id = mg.group_id
    UNION ALL
    SELECT g.material_id, g.student_id, NULL::uuid
    FROM course_material_guest_students g JOIN mats m ON m.id = g.material_id
    UNION ALL
    SELECT m.id, sa.student_id, NULL::uuid
    FROM mats m JOIN student_assignments sa ON sa.assignment_id = m.assignment_id
    UNION ALL
    SELECT aml.material_id, sa.student_id, NULL::uuid
    FROM assignment_material_links aml
    JOIN mats m ON m.id = aml.material_id
    JOIN student_assignments sa ON sa.assignment_id = aml.assignment_id
    UNION ALL
    SELECT m.id, e.student_id, e.group_id
    FROM mats m
    JOIN enrollments e ON e.instructor_id = m.instructor_id
     AND e.status IN ('active', 'pending_setup') AND e.deleted_at IS NULL
    WHERE m.group_id IS NULL AND m.assignment_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM course_material_groups x WHERE x.material_id = m.id)
  ),
  roster AS (
    SELECT DISTINCT ON (material_id, student_id) material_id, student_id, group_id
    FROM roster_raw
    ORDER BY material_id, student_id, (group_id IS NULL)
  )
  SELECT r.material_id, r.student_id, u.full_name, ig.name AS group_name,
         ma.first_opened_at, ma.first_viewed_at, ma.completed_at, ma.last_activity_at,
         ma.max_progress_pct, ma.open_count, ma.download_count, ma.total_active_seconds,
         ma.last_viewed_at, ma.view_count, ma.first_downloaded_at, ma.last_downloaded_at
  FROM roster r
  JOIN users u ON u.id = r.student_id AND COALESCE(u.is_active, TRUE) = TRUE AND u.deleted_at IS NULL
  LEFT JOIN instructor_groups ig ON ig.id = r.group_id
  LEFT JOIN material_assignments ma ON ma.material_id = r.material_id AND ma.student_id = r.student_id
`;

async function loadMaterials(instructorId, materialIds = null) {
  const { rows } = await db.query(
    `SELECT cm.id, cm.title, cm.file_type, cm.file_url, cm.due_at, cm.created_at,
            cm.instructor_id AS uploader_id, up.full_name AS uploader_name,
            COALESCE(
              (SELECT array_agg(DISTINCT ig.name) FROM course_material_groups cmg
                 JOIN instructor_groups ig ON ig.id = cmg.group_id WHERE cmg.material_id = cm.id),
              CASE WHEN ig0.name IS NOT NULL THEN ARRAY[ig0.name] ELSE ARRAY[]::text[] END
            ) AS group_names
     FROM course_materials cm
     LEFT JOIN instructor_groups ig0 ON ig0.id = cm.group_id
     LEFT JOIN users up ON up.id = cm.instructor_id
     WHERE cm.instructor_id = $1 AND ($2::uuid[] IS NULL OR cm.id = ANY($2::uuid[]))
     ORDER BY cm.created_at DESC`,
    [instructorId, materialIds],
  );
  return rows;
}

function studentRowsFor(material, rosterRows, now) {
  return rosterRows
    .filter((r) => String(r.material_id) === String(material.id))
    .map((r) => ({
      student_id: r.student_id,
      full_name: r.full_name,
      group_name: r.group_name || null,
      progress_pct: r.max_progress_pct || 0,
      open_count: r.open_count || 0,
      download_count: r.download_count || 0,
      first_viewed_at: r.first_viewed_at || null,
      first_activity_at: earliestIso([r.first_opened_at, r.first_viewed_at, r.first_downloaded_at]),
      ...materialStudentStatus(r, { dueAt: material.due_at, now }),
    }));
}

function materialCard(material, students) {
  return {
    id: material.id,
    title: material.title,
    kind: materialKind(material.file_type, material.file_url),
    group_names: material.group_names || [],
    due_at: material.due_at || null,
    created_at: material.created_at,
    /** Faylı əlavə edən (müəllim): onun baxış/yükləməsi statistikaya düşmür. */
    uploaded_by: material.uploader_id ? { id: material.uploader_id, full_name: material.uploader_name || null } : null,
    ...summarizeMaterial(students),
  };
}

async function getMaterialSummaries(instructorId, { materialIds = null, now = new Date() } = {}) {
  const materials = await loadMaterials(instructorId, materialIds);
  if (!materials.length) return [];
  const { rows } = await db.query(MATERIAL_ROSTER_SQL, [instructorId, materials.map((m) => m.id)]);
  return materials.map((m) => materialCard(m, studentRowsFor(m, rows, now)));
}

/**
 * Hesabat sətirlərini zənginləşdirir (qrup, ilk aktivlik, hadisə sayı) və filtr/səhifələmə tətbiq edir.
 * Kart həmişə filtrsiz bütün sətirlərdən hesablanır; pagination.total = seçilmiş filtrə uyğun kart rəqəmi.
 * Jurnal yalnız bu bir obyekt üçün oxunur (entity indeksi); kart siyahısı jurnala heç vaxt toxunmur.
 */
async function finishReport(instructorId, entityType, entityId, students, { query, enrich }) {
  let rows = students;
  let availableGroups = [];
  if (enrich && students.length) {
    const ids = students.map((s) => s.student_id);
    const [groupsRes, logRes] = await Promise.all([
      db.query(
        `/* report_student_groups */
         SELECT DISTINCT x.student_id, ig.id, ig.name
         FROM (
           SELECT e.student_id, e.group_id FROM enrollments e
           WHERE e.student_id = ANY($2::uuid[]) AND e.group_id IS NOT NULL
             AND e.status IN ('active', 'pending_setup') AND e.deleted_at IS NULL
           UNION
           SELECT igm.student_id, igm.group_id FROM instructor_group_members igm
           WHERE igm.student_id = ANY($2::uuid[])
         ) x
         JOIN instructor_groups ig ON ig.id = x.group_id AND ig.instructor_id = $1
         ORDER BY ig.name`,
        [instructorId, ids],
      ),
      db.query(
        `/* report_log_stats */
         SELECT student_id, MIN(created_at) AS first_activity_at, COUNT(*)::int AS activity_count
         FROM student_activity_log
         WHERE entity_type = $1 AND entity_id = $2 AND event_type <> 'reminder_sent'
         GROUP BY student_id`,
        [entityType, entityId],
      ),
    ]);
    const groupsBy = new Map();
    const allGroups = new Map();
    for (const g of groupsRes.rows) {
      const key = String(g.student_id);
      if (!groupsBy.has(key)) groupsBy.set(key, []);
      groupsBy.get(key).push({ id: g.id, name: g.name });
      allGroups.set(String(g.id), { id: g.id, name: g.name });
    }
    const statsBy = new Map(logRes.rows.map((r) => [String(r.student_id), r]));
    rows = students.map((s) =>
      enrichReportRow(s, { logStats: statsBy.get(String(s.student_id)), groups: groupsBy.get(String(s.student_id)) || [] }),
    );
    availableGroups = [...allGroups.values()].sort((a, b) => String(a.name).localeCompare(String(b.name), 'az'));
  }
  const page = applyReportQuery(rows, query, entityType);
  return {
    students: page.rows,
    pagination: { page: page.page, page_size: page.page_size, total: page.total, total_pages: page.total_pages },
    available_groups: availableGroups,
  };
}

function reportQuery(type, { query = null, filter = null } = {}) {
  return query || parseReportQuery(filter ? { filter } : {}, type);
}

async function getMaterialDetail(instructorId, materialId, { filter = null, query = null, enrich = false, now = new Date() } = {}) {
  const [material] = await loadMaterials(instructorId, [materialId]);
  if (!material) throw httpError(404, 'Material tapılmadı');
  const { rows } = await db.query(MATERIAL_ROSTER_SQL, [instructorId, [materialId]]);
  const students = studentRowsFor(material, rows, now).sort(
    (a, b) => Number(b.viewed) - Number(a.viewed) || String(a.full_name).localeCompare(String(b.full_name), 'az'),
  );
  const report = await finishReport(instructorId, 'material', material.id, students, {
    query: reportQuery('material', { query, filter }),
    enrich,
  });
  return { material: materialCard(material, students), ...report };
}

async function loadAssignments(instructorId, assignmentIds = null) {
  const { rows } = await db.query(
    `SELECT a.id, a.title, a.due_date, a.max_score, a.created_at, ig.name AS group_name
     FROM assignments a
     LEFT JOIN instructor_groups ig ON ig.id = a.group_id
     WHERE a.instructor_id = $1 AND ($2::uuid[] IS NULL OR a.id = ANY($2::uuid[]))
     ORDER BY a.created_at DESC`,
    [instructorId, assignmentIds],
  );
  return rows;
}

async function assignmentStudents(assignmentIds, assignmentsById, now) {
  if (!assignmentIds.length) return [];
  const { rows } = await db.query(
    `SELECT sa.id AS student_assignment_id, sa.assignment_id, sa.student_id, sa.status, sa.submitted_at,
            sa.reviewed_at, sa.seen_at, sa.score, sa.returned_at, sa.first_submitted_at, sa.submission_count,
            u.full_name,
            st.first_opened_at, st.started_at, st.last_activity_at
     FROM student_assignments sa
     JOIN users u ON u.id = sa.student_id AND COALESCE(u.is_active, TRUE) = TRUE AND u.deleted_at IS NULL
     LEFT JOIN assignment_status st ON st.assignment_id = sa.assignment_id AND st.student_id = sa.student_id
     WHERE sa.assignment_id = ANY($1::uuid[])`,
    [assignmentIds],
  );
  return rows.map((r) => ({
    assignment_id: r.assignment_id,
    student_assignment_id: r.student_assignment_id,
    student_id: r.student_id,
    full_name: r.full_name,
    submitted_at: r.submitted_at || null,
    reviewed_at: r.reviewed_at || null,
    returned_at: r.returned_at || null,
    first_submitted_at: r.first_submitted_at || null,
    first_activity_at: earliestIso([r.first_opened_at, r.seen_at, r.started_at, r.first_submitted_at, r.submitted_at]),
    ...assignmentStudentStatus(r, r, { dueDate: assignmentsById.get(String(r.assignment_id))?.due_date, now }),
  }));
}

function assignmentCard(a, students, now) {
  const dueEnd = assignmentDueEnd(a.due_date);
  return {
    id: a.id,
    title: a.title,
    group_name: a.group_name || null,
    due_date: a.due_date || null,
    is_overdue: Boolean(dueEnd && dueEnd < now),
    max_score: a.max_score ?? null,
    created_at: a.created_at,
    ...summarizeAssignment(students),
  };
}

async function getAssignmentSummaries(instructorId, { assignmentIds = null, now = new Date() } = {}) {
  const assignments = await loadAssignments(instructorId, assignmentIds);
  const byId = new Map(assignments.map((a) => [String(a.id), a]));
  const students = await assignmentStudents(assignments.map((a) => a.id), byId, now);
  return assignments.map((a) =>
    assignmentCard(a, students.filter((s) => String(s.assignment_id) === String(a.id)), now),
  );
}

const ASSIGNMENT_STATUS_ORDER = ['graded', 'submitted', 'returned', 'started', 'opened', 'overdue', 'not_opened'];

async function getAssignmentDetail(instructorId, assignmentId, { filter = null, query = null, enrich = false, now = new Date() } = {}) {
  const [assignment] = await loadAssignments(instructorId, [assignmentId]);
  if (!assignment) throw httpError(404, 'Tapşırıq tapılmadı');
  const byId = new Map([[String(assignment.id), assignment]]);
  const students = (await assignmentStudents([assignment.id], byId, now)).sort(
    (a, b) =>
      ASSIGNMENT_STATUS_ORDER.indexOf(a.status) - ASSIGNMENT_STATUS_ORDER.indexOf(b.status) ||
      String(a.full_name).localeCompare(String(b.full_name), 'az'),
  );
  const report = await finishReport(instructorId, 'assignment', assignment.id, students, {
    query: reportQuery('assignment', { query, filter }),
    enrich,
  });
  return { assignment: assignmentCard(assignment, students, now), ...report };
}

/**
 * İmtahan → tələbələr: təyin olunanlar + (ləğv edilməmiş) cəhdi olanlar.
 * Aqreqat sətir (exam_student_progress) + son cəhd; aqreqat hələ yoxdursa cəhddən ehtiyat hesablanır.
 * $1 = instructor_id, $2 = exam id-ləri (NULL = hamısı)
 */
const EXAM_ROSTER_SQL = `
  WITH ex AS (
    SELECT e.id FROM exams e
    WHERE e.instructor_id = $1 AND COALESCE(e.is_deleted, FALSE) = FALSE
      AND ($2::uuid[] IS NULL OR e.id = ANY($2::uuid[]))
  ),
  roster AS (
    SELECT ea.exam_id, ea.student_id FROM exam_assignments ea JOIN ex ON ex.id = ea.exam_id
    UNION
    SELECT er.exam_id, er.student_id FROM exam_results er JOIN ex ON ex.id = er.exam_id
    WHERE COALESCE(er.status, '') <> 'voided'
  )
  SELECT r.exam_id, r.student_id, u.full_name,
         p.status, p.viewed_at, p.started_at, p.completed_at, p.expired_at, p.result_released_at,
         p.latest_activity_at, p.answered_question_count, p.total_question_count, p.attempt_count,
         lr.id AS result_id, lr.status AS result_status, lr.started_at AS result_started_at,
         lr.submitted_at AS result_submitted_at, lr.score
  FROM roster r
  JOIN users u ON u.id = r.student_id AND COALESCE(u.is_active, TRUE) = TRUE AND u.deleted_at IS NULL
  LEFT JOIN exam_student_progress p ON p.exam_id = r.exam_id AND p.student_id = r.student_id
  LEFT JOIN LATERAL (
    SELECT er.id, er.status, er.started_at, er.submitted_at, er.score
    FROM exam_results er
    WHERE er.exam_id = r.exam_id AND er.student_id = r.student_id AND COALESCE(er.status, '') <> 'voided'
    ORDER BY (er.submitted_at IS NOT NULL) DESC, er.submitted_at DESC NULLS LAST, er.started_at DESC NULLS LAST
    LIMIT 1
  ) lr ON TRUE
`;

async function loadExams(instructorId, examIds = null) {
  const { rows } = await db.query(
    `SELECT e.id, e.title, e.subject, e.topic, e.duration_minutes, e.available_from, e.available_until, e.start_time,
            e.result_visibility_mode, e.created_at,
            (SELECT COUNT(*)::int FROM exam_questions q WHERE q.exam_id = e.id) AS question_count,
            (SELECT COALESCE(SUM(q.points::numeric), 0) FROM exam_questions q WHERE q.exam_id = e.id) AS max_points
     FROM exams e
     WHERE e.instructor_id = $1 AND COALESCE(e.is_deleted, FALSE) = FALSE
       AND ($2::uuid[] IS NULL OR e.id = ANY($2::uuid[]))
     ORDER BY COALESCE(e.available_from, e.start_time, e.created_at) DESC NULLS LAST`,
    [instructorId, examIds],
  );
  return rows;
}

function examStudentRows(exam, rosterRows, now) {
  return rosterRows
    .filter((r) => String(r.exam_id) === String(exam.id))
    .map((r) => ({
      student_id: r.student_id,
      full_name: r.full_name,
      result_id: r.result_id || null,
      submitted_at: r.result_submitted_at || null,
      first_activity_at: earliestIso([r.viewed_at, r.started_at, r.result_started_at]),
      ...examStudentState(r, { now, inactiveAfterMinutes: EXAM_INACTIVE_AFTER_MINUTES }),
    }));
}

/** İmtahan qrupa yox, tələbələrə təyin olunur: kartdakı qrup = təyin olunmuş tələbələrin bu müəllimdəki qrupları. */
async function loadExamGroupNames(instructorId, examIds) {
  if (!examIds.length) return new Map();
  const { rows } = await db.query(
    `/* exam_group_names */
     SELECT ea.exam_id, array_agg(DISTINCT ig.name ORDER BY ig.name) AS group_names
     FROM exam_assignments ea
     JOIN enrollments e ON e.student_id = ea.student_id
      AND e.status IN ('active', 'pending_setup') AND e.deleted_at IS NULL
     JOIN instructor_groups ig ON ig.id = e.group_id AND ig.instructor_id = $1
     WHERE ea.exam_id = ANY($2::uuid[])
     GROUP BY ea.exam_id`,
    [instructorId, examIds],
  );
  return new Map(rows.map((r) => [String(r.exam_id), r.group_names || []]));
}

function examCard(exam, students, groupNames = []) {
  const summary = summarizeExam(students);
  const maxPoints = Number(exam.max_points) || 0;
  return {
    id: exam.id,
    title: exam.title,
    subject: exam.subject || null,
    topic: exam.topic || null,
    group_names: groupNames,
    duration_minutes: exam.duration_minutes ?? null,
    available_from: exam.available_from || exam.start_time || null,
    available_until: exam.available_until || null,
    question_count: exam.question_count || 0,
    max_points: maxPoints,
    created_at: exam.created_at,
    ...summary,
    average_pct:
      summary.average_score != null && maxPoints > 0
        ? Math.round(Math.min(100, Math.max(0, (summary.average_score / maxPoints) * 100)))
        : null,
  };
}

async function getExamSummaries(instructorId, { examIds = null, now = new Date() } = {}) {
  const exams = await loadExams(instructorId, examIds);
  if (!exams.length) return [];
  const ids = exams.map((e) => e.id);
  const [{ rows }, groupNames] = await Promise.all([
    db.query(EXAM_ROSTER_SQL, [instructorId, ids]),
    loadExamGroupNames(instructorId, ids),
  ]);
  return exams.map((e) => examCard(e, examStudentRows(e, rows, now), groupNames.get(String(e.id)) || []));
}

const EXAM_STATUS_ORDER = [
  'pending_manual_grading',
  'completed',
  'expired_auto_submitted',
  'in_progress',
  'inactive',
  'expired_no_answers',
  'viewed',
  'not_started',
];

async function getExamDetail(instructorId, examId, { filter = null, query = null, enrich = false, now = new Date() } = {}) {
  const [exam] = await loadExams(instructorId, [examId]);
  if (!exam) throw httpError(404, 'İmtahan tapılmadı');
  const [{ rows }, groupNames] = await Promise.all([
    db.query(EXAM_ROSTER_SQL, [instructorId, [exam.id]]),
    loadExamGroupNames(instructorId, [exam.id]),
  ]);
  const students = examStudentRows(exam, rows, now).sort(
    (a, b) =>
      EXAM_STATUS_ORDER.indexOf(a.status) - EXAM_STATUS_ORDER.indexOf(b.status) ||
      String(a.full_name).localeCompare(String(b.full_name), 'az'),
  );
  const report = await finishReport(instructorId, 'exam', exam.id, students, {
    query: reportQuery('exam', { query, filter }),
    enrich,
  });
  return { exam: examCard(exam, students, groupNames.get(String(exam.id)) || []), ...report };
}

/**
 * Bir tələbənin bu obyekt üzrə hadisə zaman xətti. Əvvəlcə obyektin bu müəllimə aid olduğu yoxlanılır
 * (başqa workspace → 404); metadata-dan yalnız təhlükəsiz sahələr qaytarılır.
 */
async function getStudentTimeline(instructorId, entityType, entityId, studentId, { limit = 200 } = {}) {
  const loaders = { material: loadMaterials, assignment: loadAssignments, exam: loadExams };
  const load = loaders[entityType];
  if (!load) throw httpError(400, 'Naməlum obyekt növü');
  const [entity] = await load(instructorId, [entityId]);
  if (!entity) throw httpError(404, 'Tapılmadı');
  const { rows } = await db.query(
    `/* report_timeline */
     SELECT event_type, created_at, metadata, source
     FROM student_activity_log
     WHERE entity_type = $1 AND entity_id = $2 AND student_id = $3
     ORDER BY created_at ASC, id ASC
     LIMIT $4`,
    [entityType, entity.id, studentId, limit + 1],
  );
  return {
    entity_type: entityType,
    entity_id: entity.id,
    student_id: studentId,
    events: rows.slice(0, limit).map(sanitizeTimelineEvent),
    truncated: rows.length > limit,
  };
}

/**
 * Tələbə material hadisəsi. Giriş yoxlanılır; client_event_id təkrarı yazılmır;
 * vəziyyət sətri yalnız irəli gedir (bir dəfə baxan həmişə baxmış sayılır).
 */
async function recordMaterialEvent(studentId, materialId, payload = {}) {
  const { getMaterialById, studentCanAccessMaterial } = require('./courseMaterialsService');
  const material = await getMaterialById(materialId);
  if (!material) throw httpError(404, 'Material tapılmadı');
  if (!(await studentCanAccessMaterial(studentId, material))) throw httpError(403, 'İcazə yoxdur');

  const interpreted = interpretMaterialEvent(materialKind(material.file_type, material.file_url), payload);
  if (!interpreted) throw httpError(400, 'Naməlum hadisə');
  /** Fayl yükləməsi yalnız serverdə (icazəli yükləmə endpoint-i) sayılır; köhnə klient hadisəsi nəzərə alınmır. */
  if (interpreted.ignored) return { duplicate: false, ignored: true, event_type: interpreted.event_type };
  const clientEventId = payload.client_event_id ? String(payload.client_event_id).slice(0, 80) : null;

  return db.transaction(async (client) => {
    const { rows: ins } = await client.query(
      `INSERT INTO material_view_events (material_id, student_id, event_type, active_seconds, progress_pct, client_event_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (student_id, client_event_id) WHERE client_event_id IS NOT NULL DO NOTHING
       RETURNING id`,
      [materialId, studentId, interpreted.event_type, interpreted.active_seconds || null, interpreted.progress_pct, clientEventId],
    );
    if (!ins.length) return { duplicate: true, event_type: interpreted.event_type };

    const isOpenEvent = interpreted.event_type === 'material_opened' || interpreted.event_type === 'video_started';
    const { rows } = await client.query(
      `INSERT INTO material_assignments AS ma (
         material_id, student_id, first_opened_at, first_viewed_at, completed_at, last_activity_at,
         max_progress_pct, total_active_seconds, open_count, download_count, view_count, last_viewed_at, updated_at
       ) VALUES ($1, $2, NOW(),
         CASE WHEN $3 THEN NOW() END, CASE WHEN $4 THEN NOW() END, NOW(),
         COALESCE($5, 0), $6, CASE WHEN $7 THEN 1 ELSE 0 END, 0,
         CASE WHEN $8 THEN 1 ELSE 0 END, CASE WHEN $8 THEN NOW() END, NOW())
       ON CONFLICT (material_id, student_id) DO UPDATE SET
         first_opened_at = COALESCE(ma.first_opened_at, NOW()),
         first_viewed_at = COALESCE(ma.first_viewed_at, CASE WHEN $3 THEN NOW() END),
         completed_at = COALESCE(ma.completed_at, CASE WHEN $4 THEN NOW() END),
         last_activity_at = NOW(),
         max_progress_pct = GREATEST(ma.max_progress_pct, COALESCE($5, 0)),
         total_active_seconds = LEAST(ma.total_active_seconds + $6, 2000000000),
         open_count = ma.open_count + CASE WHEN $7 THEN 1 ELSE 0 END,
         view_count = ma.view_count + CASE WHEN $8 THEN 1 ELSE 0 END,
         last_viewed_at = CASE WHEN $8 THEN NOW() ELSE ma.last_viewed_at END,
         updated_at = NOW()
       RETURNING first_opened_at, first_viewed_at, completed_at, last_activity_at, max_progress_pct,
                 view_count, last_viewed_at, download_count, first_downloaded_at, last_downloaded_at`,
      [
        materialId,
        studentId,
        interpreted.viewed,
        interpreted.completed,
        interpreted.progress_pct,
        interpreted.active_seconds,
        isOpenEvent,
        interpreted.counts_as_view,
      ],
    );
    await logActivityEvent(client, {
      studentId,
      instructorId: material.instructor_id,
      entityType: 'material',
      entityId: materialId,
      eventType: interpreted.event_type,
      metadata: { progress_pct: interpreted.progress_pct, active_seconds: interpreted.active_seconds },
      groupId: material.group_id || null,
      source: 'client',
    });
    return { duplicate: false, event_type: interpreted.event_type, state: materialStudentStatus(rows[0]) };
  });
}

/**
 * Tapşırıq hadisəsi: :id = student_assignments.id. Keçid qaydaları bir yerdədir (activityProgressService):
 * assignment_status (aqreqat) sinxronu + jurnal bir tranzaksiyada.
 */
async function recordStudentAssignmentEvent(studentAssignmentId, eventType, { metadata = {} } = {}) {
  const { recordAssignmentActivity } = require('./activityProgressService');
  const state = await recordAssignmentActivity(studentAssignmentId, eventType, { metadata });
  return Boolean(state);
}

/** Controller-lərdən çağırılır: cavabı gecikdirmir, xəta əsas axını pozmur. */
function trackStudentAssignmentEvent(studentAssignmentId, eventType, opts) {
  setImmediate(() => {
    recordStudentAssignmentEvent(studentAssignmentId, eventType, opts).catch((e) =>
      console.error('[engagement] assignment event', eventType, e.message),
    );
  });
}

/**
 * Xatırlatma konteksti: obyektin adı + tələbə sətirləri (kart/hesabatla eyni funksiyalardan).
 * Bitmiş imtahan (available_until keçib) üçün heç kimə xatırlatma getmir.
 */
async function loadReminderContext(instructorId, entityType, entityId, now) {
  if (entityType === 'material') {
    const d = await getMaterialDetail(instructorId, entityId, { now });
    return { id: d.material.id, title: d.material.title, students: d.students, closed: false };
  }
  if (entityType === 'assignment') {
    const d = await getAssignmentDetail(instructorId, entityId, { now });
    return { id: d.assignment.id, title: d.assignment.title, students: d.students, closed: false };
  }
  if (entityType === 'exam') {
    const d = await getExamDetail(instructorId, entityId, { now });
    const until = d.exam.available_until ? new Date(d.exam.available_until) : null;
    return {
      id: d.exam.id,
      title: d.exam.title,
      students: d.students,
      closed: Boolean(until && !Number.isNaN(until.getTime()) && until < now),
    };
  }
  throw httpError(400, 'Naməlum obyekt növü');
}

function pickCandidates(students, studentIds) {
  const wanted = Array.isArray(studentIds) && studentIds.length ? new Set(studentIds.map(String)) : null;
  return students.filter((s) => !wanted || wanted.has(String(s.student_id)));
}

async function recentReminderMap(queryable, entityType, entityId, studentIds, now) {
  if (!studentIds.length) return new Map();
  const { rows } = await queryable.query(
    `/* reminder_recent */
     SELECT student_id, MAX(sent_at) AS last_sent_at FROM reminder_log
     WHERE entity_type = $1 AND entity_id = $2 AND status = 'sent'
       AND student_id = ANY($3::uuid[])
       AND sent_at > $4::timestamptz - make_interval(hours => $5)
     GROUP BY student_id`,
    [entityType, entityId, studentIds, now.toISOString(), REMINDER_COOLDOWN_HOURS],
  );
  return new Map(rows.map((r) => [String(r.student_id), r.last_sent_at]));
}

async function recipientLocales(studentIds) {
  if (!studentIds.length) return new Map();
  const { rows } = await db.query(`/* reminder_locales */ SELECT id, locale FROM users WHERE id = ANY($1::uuid[])`, [studentIds]);
  return new Map(rows.map((r) => [String(r.id), r.locale]));
}

/**
 * Göndərmədən önizləmə (heç nə yazılmır): alıcılar, son REMINDER_COOLDOWN_HOURS saatda artıq xatırlatma alanlar,
 * uyğun olmayanlar və tələbəyə gedəcək mesaj (hər dil üçün). Admin üçün bağlıdır (controller write=true).
 */
async function previewReminders(instructorId, entityType, entityId, { studentIds = null, now = new Date() } = {}) {
  const ctx = await loadReminderContext(instructorId, entityType, entityId, now);
  const candidates = pickCandidates(ctx.students, studentIds);
  const eligibleIds = candidates
    .filter((s) => !ctx.closed && reminderEligibleFor(entityType, s))
    .map((s) => s.student_id);
  const recent = await recentReminderMap(db, entityType, ctx.id, eligibleIds, now);
  const plan = planReminderRecipients({
    entityType,
    candidates,
    recentSentAt: recent,
    cooldownHours: REMINDER_COOLDOWN_HOURS,
    now,
    closed: ctx.closed,
  });
  const locales = await recipientLocales(plan.recipients.map((r) => r.student_id));
  return {
    entity: { type: entityType, id: ctx.id, title: ctx.title },
    closed: ctx.closed,
    cooldown_hours: REMINDER_COOLDOWN_HOURS,
    ...plan,
    messages: previewMessages(entityType, ctx.title, plan.recipients, locales),
    counts: {
      recipients: plan.recipients.length,
      recently_reminded: plan.recently_reminded.length,
      not_eligible: plan.not_eligible.length,
    },
  };
}

/**
 * Müəllimin təsdiqindən sonra göndərmə. Eyni obyekt üçün paralel iki sorğu advisory lock ilə növbəyə düşür və
 * soyuma müddəti kilidin içində yenidən yoxlanılır — ikiqat klik eyni tələbəyə ikinci xatırlatma yaratmır.
 * Hər alıcı üçün reminder_log-a çatdırılma nəticəsi (sent | failed | skipped_recent) və jurnala reminder_sent yazılır.
 * Avtomatik xatırlatma yoxdur: bu funksiya yalnız müəllimin əl ilə göndərməsindən çağırılır.
 */
async function sendReminders(instructorId, entityType, entityId, { studentIds = null, now = new Date() } = {}) {
  const ctx = await loadReminderContext(instructorId, entityType, entityId, now);
  const candidates = pickCandidates(ctx.students, studentIds);
  const eligible = candidates.filter((s) => !ctx.closed && reminderEligibleFor(entityType, s));
  const result = {
    sent: 0,
    failed: 0,
    skipped_recent: 0,
    not_eligible: candidates.length - eligible.length,
    recipients: [],
    batch_id: null,
  };
  if (!eligible.length) return result;

  const locales = await recipientLocales(eligible.map((s) => s.student_id));
  const batchId = crypto.randomUUID();
  result.batch_id = batchId;
  const type = REMINDER_NOTIFICATION_TYPES[entityType];

  await db.transaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`reminder:${entityType}:${ctx.id}`]);
    const recent = await recentReminderMap(client, entityType, ctx.id, eligible.map((s) => s.student_id), now);
    for (const [i, s] of eligible.entries()) {
      if (recent.has(String(s.student_id))) {
        await client.query(
          `INSERT INTO reminder_log (instructor_id, entity_type, entity_id, student_id, status, batch_id)
           VALUES ($1, $2, $3, $4, 'skipped_recent', $5)`,
          [instructorId, entityType, ctx.id, s.student_id, batchId],
        );
        result.skipped_recent += 1;
        continue;
      }
      const msg = reminderMessage(entityType, ctx.title, locales.get(String(s.student_id)));
      const delivery = await deliverReminderNotification(client, {
        recipientId: s.student_id,
        instructorId,
        entityType,
        entityId: ctx.id,
        type,
        title: msg.title,
        body: msg.body,
        meta: reminderMeta(entityType, ctx.id),
        dedupeKey: `reminder:${entityType}:${ctx.id}:${batchId}`,
        savepoint: `reminder_${i}`,
      });
      const delivered = delivery.status === 'delivered';
      await client.query(
        `INSERT INTO reminder_log
           (instructor_id, entity_type, entity_id, student_id, channel, status, notification_id, message_preview, batch_id, error_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          instructorId,
          entityType,
          ctx.id,
          s.student_id,
          delivery.channel,
          delivered ? 'sent' : 'failed',
          delivery.notificationId,
          msg.body,
          batchId,
          delivery.errorCode,
        ],
      );
      await logActivityEvent(client, {
        studentId: s.student_id,
        instructorId,
        entityType,
        entityId: ctx.id,
        eventType: ACTIVITY_EVENTS.REMINDER_SENT,
        metadata: { batch_id: batchId, delivery: delivery.status, channel: delivery.channel },
        dedupeKey: `reminder:${batchId}`,
        source: 'server',
      });
      if (!delivered) {
        result.failed += 1;
        continue;
      }
      if (entityType === 'assignment') {
        await client.query(
          `UPDATE student_assignments SET reminder_sent_at = $3 WHERE assignment_id = $1 AND student_id = $2`,
          [ctx.id, s.student_id, now],
        );
      }
      result.sent += 1;
      result.recipients.push(s.student_id);
    }
  });
  return result;
}

async function setMaterialDueAt(instructorId, materialId, dueAt) {
  const { rows } = await db.query(
    `UPDATE course_materials SET due_at = $3 WHERE id = $1 AND instructor_id = $2 RETURNING id, due_at`,
    [materialId, instructorId, dueAt],
  );
  if (!rows[0]) throw httpError(404, 'Material tapılmadı');
  return rows[0];
}

module.exports = {
  REMINDER_COOLDOWN_HOURS,
  getMaterialSummaries,
  getMaterialDetail,
  getAssignmentSummaries,
  getAssignmentDetail,
  getExamSummaries,
  getExamDetail,
  EXAM_ROSTER_SQL,
  recordMaterialEvent,
  recordStudentAssignmentEvent,
  trackStudentAssignmentEvent,
  getStudentTimeline,
  previewReminders,
  sendReminders,
  setMaterialDueAt,
};
