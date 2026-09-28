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
         ma.max_progress_pct, ma.open_count, ma.download_count, ma.total_active_seconds
  FROM roster r
  JOIN users u ON u.id = r.student_id AND COALESCE(u.is_active, TRUE) = TRUE AND u.deleted_at IS NULL
  LEFT JOIN instructor_groups ig ON ig.id = r.group_id
  LEFT JOIN material_assignments ma ON ma.material_id = r.material_id AND ma.student_id = r.student_id
`;

async function loadMaterials(instructorId, materialIds = null) {
  const { rows } = await db.query(
    `SELECT cm.id, cm.title, cm.file_type, cm.file_url, cm.due_at, cm.created_at,
            COALESCE(
              (SELECT array_agg(DISTINCT ig.name) FROM course_material_groups cmg
                 JOIN instructor_groups ig ON ig.id = cmg.group_id WHERE cmg.material_id = cm.id),
              CASE WHEN ig0.name IS NOT NULL THEN ARRAY[ig0.name] ELSE ARRAY[]::text[] END
            ) AS group_names
     FROM course_materials cm
     LEFT JOIN instructor_groups ig0 ON ig0.id = cm.group_id
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
            sa.reviewed_at, sa.seen_at, sa.score, u.full_name,
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

const ASSIGNMENT_STATUS_ORDER = ['graded', 'submitted', 'started', 'opened', 'overdue', 'not_opened'];

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
         max_progress_pct, total_active_seconds, open_count, download_count
       ) VALUES ($1, $2, NOW(),
         CASE WHEN $3 THEN NOW() END, CASE WHEN $4 THEN NOW() END, NOW(),
         COALESCE($5, 0), $6, CASE WHEN $7 THEN 1 ELSE 0 END, CASE WHEN $8 THEN 1 ELSE 0 END)
       ON CONFLICT (material_id, student_id) DO UPDATE SET
         first_opened_at = COALESCE(ma.first_opened_at, NOW()),
         first_viewed_at = COALESCE(ma.first_viewed_at, CASE WHEN $3 THEN NOW() END),
         completed_at = COALESCE(ma.completed_at, CASE WHEN $4 THEN NOW() END),
         last_activity_at = NOW(),
         max_progress_pct = GREATEST(ma.max_progress_pct, COALESCE($5, 0)),
         total_active_seconds = LEAST(ma.total_active_seconds + $6, 2000000000),
         open_count = ma.open_count + CASE WHEN $7 THEN 1 ELSE 0 END,
         download_count = ma.download_count + CASE WHEN $8 THEN 1 ELSE 0 END
       RETURNING first_opened_at, first_viewed_at, completed_at, last_activity_at, max_progress_pct`,
      [
        materialId,
        studentId,
        interpreted.viewed,
        interpreted.completed,
        interpreted.progress_pct,
        interpreted.active_seconds,
        isOpenEvent,
        interpreted.downloaded,
      ],
    );
    await logActivity(client, {
      studentId,
      instructorId: material.instructor_id,
      entityType: 'material',
      entityId: materialId,
      eventType: interpreted.event_type,
      metadata: { progress_pct: interpreted.progress_pct, active_seconds: interpreted.active_seconds },
    });
    return { duplicate: false, event_type: interpreted.event_type, state: materialStudentStatus(rows[0]) };
  });
}

/** Tapşırıq hadisəsi: :id = student_assignments.id. Açılma/başlama assignment_status-a, hamısı jurnala. */
async function recordStudentAssignmentEvent(studentAssignmentId, eventType, { metadata = {} } = {}) {
  const { rows } = await db.query(
    `SELECT sa.assignment_id, sa.student_id, a.instructor_id
     FROM student_assignments sa JOIN assignments a ON a.id = sa.assignment_id
     WHERE sa.id = $1`,
    [studentAssignmentId],
  );
  const row = rows[0];
  if (!row) return false;
  await db.transaction(async (client) => {
    if (eventType === 'assignment_opened' || eventType === 'assignment_started') {
      const started = eventType === 'assignment_started';
      await client.query(
        `INSERT INTO assignment_status AS s (assignment_id, student_id, first_opened_at, started_at, last_activity_at)
         VALUES ($1, $2, NOW(), CASE WHEN $3 THEN NOW() END, NOW())
         ON CONFLICT (assignment_id, student_id) DO UPDATE SET
           first_opened_at = COALESCE(s.first_opened_at, NOW()),
           started_at = COALESCE(s.started_at, CASE WHEN $3 THEN NOW() END),
           last_activity_at = NOW()`,
        [row.assignment_id, row.student_id, started],
      );
    } else {
      await client.query(
        `INSERT INTO assignment_status AS s (assignment_id, student_id, first_opened_at, last_activity_at)
         VALUES ($1, $2, NOW(), NOW())
         ON CONFLICT (assignment_id, student_id) DO UPDATE SET last_activity_at = NOW()`,
        [row.assignment_id, row.student_id],
      );
    }
    await logActivity(client, {
      studentId: row.student_id,
      instructorId: row.instructor_id,
      entityType: 'assignment',
      entityId: row.assignment_id,
      eventType,
      metadata,
    });
  });
  return true;
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
  recordMaterialEvent,
  recordStudentAssignmentEvent,
  trackStudentAssignmentEvent,
  sendReminders,
  setMaterialDueAt,
};
