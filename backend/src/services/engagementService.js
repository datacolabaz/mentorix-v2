const db = require('../utils/db');
const {
  materialKind,
  interpretMaterialEvent,
  materialStudentStatus,
  assignmentStudentStatus,
  summarizeMaterial,
  summarizeAssignment,
  MATERIAL_FILTERS,
  ASSIGNMENT_FILTERS,
  reminderEligible,
  assignmentDueEnd,
} = require('./engagementRules');
const { logActivityEvent } = require('./activityProgressService');
const { examStudentState, summarizeExam, EXAM_FILTERS, EXAM_INACTIVE_AFTER_MINUTES } = require('./activityStatusRules');

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

async function getMaterialDetail(instructorId, materialId, { filter = null, now = new Date() } = {}) {
  const [material] = await loadMaterials(instructorId, [materialId]);
  if (!material) throw httpError(404, 'Material tapılmadı');
  const { rows } = await db.query(MATERIAL_ROSTER_SQL, [instructorId, [materialId]]);
  const students = studentRowsFor(material, rows, now).sort(
    (a, b) => Number(b.viewed) - Number(a.viewed) || String(a.full_name).localeCompare(String(b.full_name), 'az'),
  );
  const fn = filter ? MATERIAL_FILTERS[filter] : null;
  return { material: materialCard(material, students), students: fn ? students.filter(fn) : students };
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

async function getAssignmentDetail(instructorId, assignmentId, { filter = null, now = new Date() } = {}) {
  const [assignment] = await loadAssignments(instructorId, [assignmentId]);
  if (!assignment) throw httpError(404, 'Tapşırıq tapılmadı');
  const byId = new Map([[String(assignment.id), assignment]]);
  const students = (await assignmentStudents([assignment.id], byId, now)).sort(
    (a, b) =>
      ASSIGNMENT_STATUS_ORDER.indexOf(a.status) - ASSIGNMENT_STATUS_ORDER.indexOf(b.status) ||
      String(a.full_name).localeCompare(String(b.full_name), 'az'),
  );
  const fn = filter ? ASSIGNMENT_FILTERS[filter] : null;
  return { assignment: assignmentCard(assignment, students, now), students: fn ? students.filter(fn) : students };
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
    `SELECT e.id, e.title, e.subject, e.duration_minutes, e.available_from, e.available_until, e.start_time,
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
      ...examStudentState(r, { now, inactiveAfterMinutes: EXAM_INACTIVE_AFTER_MINUTES }),
    }));
}

function examCard(exam, students) {
  const summary = summarizeExam(students);
  const maxPoints = Number(exam.max_points) || 0;
  return {
    id: exam.id,
    title: exam.title,
    subject: exam.subject || null,
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
  const { rows } = await db.query(EXAM_ROSTER_SQL, [instructorId, exams.map((e) => e.id)]);
  return exams.map((e) => examCard(e, examStudentRows(e, rows, now)));
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

async function getExamDetail(instructorId, examId, { filter = null, now = new Date() } = {}) {
  const [exam] = await loadExams(instructorId, [examId]);
  if (!exam) throw httpError(404, 'İmtahan tapılmadı');
  const { rows } = await db.query(EXAM_ROSTER_SQL, [instructorId, [examId]]);
  const students = examStudentRows(exam, rows, now).sort(
    (a, b) =>
      EXAM_STATUS_ORDER.indexOf(a.status) - EXAM_STATUS_ORDER.indexOf(b.status) ||
      String(a.full_name).localeCompare(String(b.full_name), 'az'),
  );
  const fn = filter ? EXAM_FILTERS[filter] : null;
  return { exam: examCard(exam, students), students: fn ? students.filter(fn) : students };
}

async function logActivity(client, { studentId, instructorId, entityType, entityId, eventType, metadata = {} }) {
  await client.query(
    `INSERT INTO student_activity_log (student_id, instructor_id, entity_type, entity_id, event_type, metadata)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [studentId, instructorId || null, entityType, entityId, eventType, JSON.stringify(metadata)],
  );
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

async function sendReminders(instructorId, entityType, entityId, { studentIds = null, now = new Date() } = {}) {
  const detail =
    entityType === 'material'
      ? await getMaterialDetail(instructorId, entityId, { now })
      : await getAssignmentDetail(instructorId, entityId, { now });
  const title = entityType === 'material' ? detail.material.title : detail.assignment.title;
  const wanted = Array.isArray(studentIds) && studentIds.length ? new Set(studentIds.map(String)) : null;
  const candidates = detail.students.filter((s) => !wanted || wanted.has(String(s.student_id)));
  const eligible = candidates.filter((s) => reminderEligible(entityType, s));
  const result = { sent: 0, skipped_recent: 0, not_eligible: candidates.length - eligible.length, recipients: [] };
  if (!eligible.length) return result;

  const { rows: recent } = await db.query(
    `SELECT DISTINCT student_id FROM reminder_log
     WHERE entity_type = $1 AND entity_id = $2 AND status = 'sent'
       AND student_id = ANY($3::uuid[])
       AND sent_at > $4::timestamptz - make_interval(hours => $5)`,
    [entityType, entityId, eligible.map((s) => s.student_id), now.toISOString(), REMINDER_COOLDOWN_HOURS],
  );
  const recentSet = new Set(recent.map((r) => String(r.student_id)));

  const body =
    entityType === 'material'
      ? `Müəlliminiz «${title}» materialına baxmağınızı xatırladır.`
      : `Müəlliminiz «${title}» tapşırığını təqdim etməyinizi xatırladır.`;
  const type = entityType === 'material' ? 'material_reminder' : 'assignment_reminder';

  await db.transaction(async (client) => {
    for (const s of eligible) {
      if (recentSet.has(String(s.student_id))) {
        await client.query(
          `INSERT INTO reminder_log (instructor_id, entity_type, entity_id, student_id, status)
           VALUES ($1, $2, $3, $4, 'skipped_recent')`,
          [instructorId, entityType, entityId, s.student_id],
        );
        result.skipped_recent += 1;
        continue;
      }
      await client.query(
        `INSERT INTO notifications (user_id, title, body, type, is_read, meta)
         VALUES ($1, $2, $3, $4, FALSE, $5::jsonb)`,
        [
          s.student_id,
          'Xatırlatma',
          body,
          type,
          JSON.stringify(entityType === 'material' ? { material_id: entityId } : { assignment_id: entityId }),
        ],
      );
      await client.query(
        `INSERT INTO reminder_log (instructor_id, entity_type, entity_id, student_id, status)
         VALUES ($1, $2, $3, $4, 'sent')`,
        [instructorId, entityType, entityId, s.student_id],
      );
      await logActivity(client, {
        studentId: s.student_id,
        instructorId,
        entityType,
        entityId,
        eventType: 'reminder_sent',
      });
      if (entityType === 'assignment') {
        await client.query(
          `UPDATE student_assignments SET reminder_sent_at = NOW() WHERE assignment_id = $1 AND student_id = $2`,
          [entityId, s.student_id],
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
  sendReminders,
  setMaterialDueAt,
};
