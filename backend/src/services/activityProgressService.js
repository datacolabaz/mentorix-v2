const db = require('../utils/db');
const { nextAssignmentStatus, ACTIVITY_EVENTS } = require('./activityStatusRules');
const { assignmentStudentStatus, assignmentDueEnd } = require('./engagementRules');
const hooks = require('./activityNotificationHooks');

/** Eyni tələbənin eyni fayla bu pəncərədə gələn ikinci sorğusu (brauzer təkrarı) ayrıca yükləmə sayılmır. */
const DOWNLOAD_DEDUPE_WINDOW_SECONDS = 10;

function httpError(status, message, code) {
  const err = new Error(message);
  err.statusCode = status;
  if (code) err.code = code;
  return err;
}

/**
 * Append-only jurnal yazısı. dedupe_key verilibsə, təkrar yazı sakitcə atlanır.
 * @returns {Promise<boolean>} yeni sətir yazıldısa true
 */
async function logActivityEvent(
  client,
  { studentId, instructorId = null, entityType, entityId, eventType, metadata = {}, groupId = null, dedupeKey = null, source = 'server' },
) {
  const { rows } = await client.query(
    `INSERT INTO student_activity_log
       (student_id, instructor_id, entity_type, entity_id, event_type, metadata, group_id, dedupe_key, source)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)
     ON CONFLICT (entity_type, entity_id, student_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
     RETURNING id`,
    [studentId, instructorId, entityType, entityId, eventType, JSON.stringify(metadata || {}), groupId, dedupeKey, source],
  );
  return rows.length > 0;
}

const ASSIGNMENT_SOURCE_SQL = `
  SELECT sa.id, sa.assignment_id, sa.student_id, sa.status, sa.submitted_at, sa.first_submitted_at,
         sa.reviewed_at, sa.returned_at, sa.submission_count, sa.seen_at, sa.score, sa.late_decision,
         a.instructor_id, a.due_date, a.group_id, a.title
  FROM student_assignments sa
  JOIN assignments a ON a.id = sa.assignment_id
  WHERE sa.id = $1`;

/**
 * assignment_status (progress) sətrini mənbədən (student_assignments) sinxronlaşdırır.
 * Sayğaclar mənbədən köçürülür (artırılmır), ona görə təkrar çağırış rəqəmi şişirtmir.
 * Status kartlarla eyni funksiyadan (assignmentStudentStatus) hesablanır.
 */
async function syncAssignmentProgress(client, sa, { event = null, now = new Date() } = {}) {
  await client.query(
    `INSERT INTO assignment_status (assignment_id, student_id, status, created_at, updated_at)
     VALUES ($1, $2, 'not_opened', $3, $3)
     ON CONFLICT (assignment_id, student_id) DO NOTHING`,
    [sa.assignment_id, sa.student_id, now],
  );
  const { rows } = await client.query(
    `SELECT first_opened_at, started_at, last_activity_at, status
     FROM assignment_status WHERE assignment_id = $1 AND student_id = $2 FOR UPDATE`,
    [sa.assignment_id, sa.student_id],
  );
  const st = { ...(rows[0] || {}) };
  if (event === 'opened' || event === 'started') st.first_opened_at = st.first_opened_at || now;
  if (event === 'started') st.started_at = st.started_at || now;
  const state = assignmentStudentStatus(sa, st, { dueDate: sa.due_date, now });
  const dueEnd = assignmentDueEnd(sa.due_date);
  await client.query(
    `UPDATE assignment_status SET
       first_opened_at = $3,
       started_at = $4,
       last_activity_at = $5,
       status = $6,
       submitted_at = $7,
       graded_at = $8,
       returned_at = $9,
       submission_count = $10,
       is_late = $11,
       overdue_at = CASE WHEN $12 THEN COALESCE(overdue_at, $13) ELSE overdue_at END,
       updated_at = $5
     WHERE assignment_id = $1 AND student_id = $2`,
    [
      sa.assignment_id,
      sa.student_id,
      st.first_opened_at || null,
      st.started_at || null,
      now,
      state.progress_status,
      sa.submitted_at || null,
      state.graded ? sa.reviewed_at || now : null,
      sa.returned_at || null,
      Math.max(Number(sa.submission_count) || 0, state.submitted ? 1 : 0),
      state.is_late,
      Boolean((state.overdue || state.is_late) && dueEnd),
      dueEnd,
    ],
  );
  return state;
}

const ASSIGNMENT_EVENT_MAP = Object.freeze({
  assignment_opened: 'opened',
  assignment_started: 'started',
  assignment_submitted: 'submitted',
  assignment_graded: 'graded',
  assignment_returned: 'returned',
});

/**
 * Tapşırıq hadisəsi (student_assignments.id üzrə): progress sinxronu + jurnal, bir tranzaksiyada.
 * Təhvil hadisəsi gecikibsə jurnala assignment_late_submitted yazılır.
 */
async function recordAssignmentActivity(studentAssignmentId, eventType, { metadata = {}, now = new Date(), actorId = null } = {}) {
  const event = ASSIGNMENT_EVENT_MAP[eventType];
  if (!event) throw httpError(400, 'Naməlum hadisə');
  const result = await db.transaction(async (client) => {
    const { rows } = await client.query(ASSIGNMENT_SOURCE_SQL, [studentAssignmentId]);
    const sa = rows[0];
    if (!sa) return null;
    const state = await syncAssignmentProgress(client, sa, { event, now });
    const storedType =
      event === 'submitted' && state.is_late ? ACTIVITY_EVENTS.ASSIGNMENT_LATE_SUBMITTED : eventType;
    const dedupeKey =
      event === 'submitted'
        ? `submitted:${Number(sa.submission_count) || 1}`
        : event === 'returned' && sa.returned_at
          ? `returned:${new Date(sa.returned_at).getTime()}`
          : null;
    await logActivityEvent(client, {
      studentId: sa.student_id,
      instructorId: sa.instructor_id,
      entityType: 'assignment',
      entityId: sa.assignment_id,
      eventType: storedType,
      metadata: { ...metadata, ...(actorId ? { actor_id: actorId } : {}) },
      groupId: sa.group_id || null,
      dedupeKey,
    });
    return { sa, state };
  });
  if (result && event === 'submitted') {
    hooks.onAssignmentSubmitted({
      studentAssignmentId,
      assignmentId: result.sa.assignment_id,
      studentId: result.sa.student_id,
      instructorId: result.sa.instructor_id,
      submissionCount: Number(result.sa.submission_count) || 1,
      late: result.state.is_late,
    });
  }
  if (result && event === 'graded' && result.sa.reviewed_at) {
    hooks.onAssignmentGraded({
      studentAssignmentId,
      assignmentId: result.sa.assignment_id,
      studentId: result.sa.student_id,
      instructorId: result.sa.instructor_id,
      reviewedAt: result.sa.reviewed_at,
    });
  }
  return result ? result.state : null;
}

/**
 * Müəllim işi yenidən işləməyə qaytarır. Yalnız təhvil verilmiş (və ya qiymətləndirilmiş) iş qaytarıla bilər.
 * Tələbə yenidən redaktə edib təhvil verə bilsin deyə submitted_at sıfırlanır; ilk təhvil vaxtı first_submitted_at-da qalır.
 * Əvvəlki bal/yoxlama vaxtı jurnalın metadata-sında saxlanılır.
 */
async function returnAssignmentForRevision({ instructorId, studentAssignmentId, feedback = null, now = new Date() }) {
  const out = await db.transaction(async (client) => {
    const { rows } = await client.query(
      `SELECT sa.id, sa.status, sa.submitted_at, sa.reviewed_at, sa.score, sa.first_submitted_at,
              sa.assignment_id, sa.student_id, a.due_date, a.instructor_id
       FROM student_assignments sa
       JOIN assignments a ON a.id = sa.assignment_id
       WHERE sa.id = $1 AND a.instructor_id = $2
       FOR UPDATE OF sa`,
      [studentAssignmentId, instructorId],
    );
    const cur = rows[0];
    if (!cur) throw httpError(404, 'Tapılmadı');
    const current = assignmentStudentStatus(cur, null, { dueDate: cur.due_date, now }).progress_status;
    const next = nextAssignmentStatus(current, 'returned');
    if (!next.valid) {
      throw httpError(409, 'Yalnız təhvil verilmiş iş yenidən işləməyə qaytarıla bilər', 'ASSIGNMENT_NOT_RETURNABLE');
    }
    const { rows: updated } = await client.query(
      `UPDATE student_assignments
       SET status = 'returned',
           returned_at = $2,
           first_submitted_at = COALESCE(first_submitted_at, submitted_at),
           submitted_at = NULL,
           done_at = NULL,
           reviewed_at = NULL,
           score = NULL,
           feedback = COALESCE($3, feedback)
       WHERE id = $1
       RETURNING id, status, returned_at, feedback, submission_count`,
      [studentAssignmentId, now, feedback],
    );
    const { rows: src } = await client.query(ASSIGNMENT_SOURCE_SQL, [studentAssignmentId]);
    const sa = src[0];
    await syncAssignmentProgress(client, sa, { event: 'returned', now });
    await logActivityEvent(client, {
      studentId: sa.student_id,
      instructorId: sa.instructor_id,
      entityType: 'assignment',
      entityId: sa.assignment_id,
      eventType: ACTIVITY_EVENTS.ASSIGNMENT_RETURNED_FOR_REVISION,
      metadata: {
        actor_id: instructorId,
        previous_status: current,
        previous_score: cur.score ?? null,
        previous_reviewed_at: cur.reviewed_at || null,
        previous_submitted_at: cur.submitted_at || null,
      },
      groupId: sa.group_id || null,
      dedupeKey: `returned:${now.getTime()}`,
    });
    return { row: updated[0], sa };
  });
  hooks.onAssignmentReturnedForRevision({
    studentAssignmentId,
    assignmentId: out.sa.assignment_id,
    studentId: out.sa.student_id,
    instructorId,
    returnedAt: now,
  });
  return out.row;
}

/**
 * Server tərəfində icazəli fayl yükləməsi (serveMaterialFile, ?download=1).
 * Yalnız tələbə yükləməsi sayılır: materialı əlavə edən müəllim (fayl sahibi), admin və valideyn sayılmır.
 * Ümumi yükləmə hər icazəli yükləmədə artır; unikal yükləyən tələbə başına bir sətirdir.
 */
async function recordServerMaterialDownload({ material, userId, role, now = new Date() }) {
  if (!material?.id || !userId) return { recorded: false, reason: 'missing' };
  if (role !== 'student') return { recorded: false, reason: 'not_student' };
  if (String(userId) === String(material.instructor_id)) return { recorded: false, reason: 'owner' };
  const bucket = Math.floor(now.getTime() / (DOWNLOAD_DEDUPE_WINDOW_SECONDS * 1000));
  return db.transaction(async (client) => {
    const inserted = await logActivityEvent(client, {
      studentId: userId,
      instructorId: material.instructor_id || null,
      entityType: 'material',
      entityId: material.id,
      eventType: ACTIVITY_EVENTS.MATERIAL_DOWNLOADED,
      metadata: { channel: 'backend_download' },
      groupId: material.group_id || null,
      dedupeKey: `download:${bucket}`,
    });
    if (!inserted) return { recorded: false, reason: 'duplicate' };
    await client.query(
      `INSERT INTO material_assignments AS ma (
         material_id, student_id, download_count, first_downloaded_at, last_downloaded_at, last_activity_at, updated_at
       ) VALUES ($1, $2, 1, $3, $3, $3, $3)
       ON CONFLICT (material_id, student_id) DO UPDATE SET
         download_count = ma.download_count + 1,
         first_downloaded_at = COALESCE(ma.first_downloaded_at, $3),
         last_downloaded_at = $3,
         last_activity_at = GREATEST(COALESCE(ma.last_activity_at, $3), $3),
         updated_at = $3`,
      [material.id, userId, now],
    );
    return { recorded: true };
  });
}

module.exports = {
  DOWNLOAD_DEDUPE_WINDOW_SECONDS,
  logActivityEvent,
  syncAssignmentProgress,
  recordAssignmentActivity,
  returnAssignmentForRevision,
  recordServerMaterialDownload,
};
