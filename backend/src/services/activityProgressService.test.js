const test = require('node:test');
const assert = require('node:assert/strict');

/** Yaddaşda sadə DB: yalnız bu servisin işlətdiyi sorğular tanınır. */
const state = {
  log: [],
  materialAssignments: new Map(),
  studentAssignments: new Map(),
  assignments: new Map(),
  assignmentStatus: new Map(),
};

function logInsert(params) {
  const [studentId, instructorId, entityType, entityId, eventType, metadata, groupId, dedupeKey, source] = params;
  if (dedupeKey != null) {
    const dup = state.log.find(
      (r) => r.entity_type === entityType && r.entity_id === entityId && r.student_id === studentId && r.dedupe_key === dedupeKey,
    );
    if (dup) return { rows: [] };
  }
  const row = { id: state.log.length + 1, student_id: studentId, instructor_id: instructorId, entity_type: entityType, entity_id: entityId, event_type: eventType, metadata: JSON.parse(metadata), group_id: groupId, dedupe_key: dedupeKey, source };
  state.log.push(row);
  return { rows: [{ id: row.id }] };
}

function saSource(id) {
  const sa = state.studentAssignments.get(id);
  if (!sa) return { rows: [] };
  const a = state.assignments.get(sa.assignment_id);
  return { rows: [{ ...sa, instructor_id: a.instructor_id, due_date: a.due_date, group_id: a.group_id, title: a.title }] };
}

const client = {
  async query(sql, params = []) {
    if (/INSERT INTO student_activity_log/.test(sql)) return logInsert(params);
    if (/INSERT INTO material_assignments/.test(sql)) {
      const [materialId, studentId, now] = params;
      const key = `${materialId}:${studentId}`;
      const cur = state.materialAssignments.get(key);
      if (!cur) {
        state.materialAssignments.set(key, { material_id: materialId, student_id: studentId, download_count: 1, first_downloaded_at: now, last_downloaded_at: now });
      } else {
        cur.download_count += 1;
        cur.first_downloaded_at = cur.first_downloaded_at || now;
        cur.last_downloaded_at = now;
      }
      return { rows: [], rowCount: 1 };
    }
    if (/FOR UPDATE OF sa/.test(sql)) {
      const [id, instructorId] = params;
      const src = saSource(id).rows[0];
      if (!src || src.instructor_id !== instructorId) return { rows: [] };
      return { rows: [src] };
    }
    if (/UPDATE student_assignments\s+SET status = 'returned'/.test(sql)) {
      const [id, now, feedback] = params;
      const sa = state.studentAssignments.get(id);
      Object.assign(sa, {
        status: 'returned',
        returned_at: now,
        first_submitted_at: sa.first_submitted_at || sa.submitted_at,
        submitted_at: null,
        done_at: null,
        reviewed_at: null,
        score: null,
        feedback: feedback ?? sa.feedback,
      });
      return { rows: [{ id, status: sa.status, returned_at: sa.returned_at, feedback: sa.feedback, submission_count: sa.submission_count }] };
    }
    if (/FROM student_assignments sa\s+JOIN assignments a ON a.id = sa.assignment_id\s+WHERE sa.id = \$1/.test(sql)) {
      return saSource(params[0]);
    }
    if (/INSERT INTO assignment_status/.test(sql)) {
      const key = `${params[0]}:${params[1]}`;
      if (!state.assignmentStatus.has(key)) state.assignmentStatus.set(key, { status: 'not_opened' });
      return { rows: [] };
    }
    if (/FROM assignment_status WHERE assignment_id = \$1 AND student_id = \$2 FOR UPDATE/.test(sql)) {
      return { rows: [state.assignmentStatus.get(`${params[0]}:${params[1]}`)] };
    }
    if (/UPDATE assignment_status SET/.test(sql)) {
      const key = `${params[0]}:${params[1]}`;
      Object.assign(state.assignmentStatus.get(key), {
        first_opened_at: params[2],
        started_at: params[3],
        last_activity_at: params[4],
        status: params[5],
        submitted_at: params[6],
        graded_at: params[7],
        returned_at: params[8],
        submission_count: params[9],
        is_late: params[10],
      });
      return { rows: [] };
    }
    throw new Error(`fake db: unexpected SQL: ${sql.slice(0, 80)}`);
  },
};

const dbId = require.resolve('../utils/db');
require.cache[dbId] = {
  id: dbId,
  filename: dbId,
  loaded: true,
  exports: { query: client.query, transaction: async (cb) => cb(client) },
};

const {
  recordServerMaterialDownload,
  returnAssignmentForRevision,
  recordAssignmentActivity,
  DOWNLOAD_DEDUPE_WINDOW_SECONDS,
} = require('./activityProgressService');
const { materialStudentStatus, summarizeMaterial } = require('./engagementRules');

const TEACHER = 'teacher-1';
const OTHER_TEACHER = 'teacher-2';
const MATERIAL = { id: 'mat-1', instructor_id: TEACHER, group_id: 'g-1' };

test('downloads: unique downloaders vs total downloads; uploader and non-students excluded; double-click deduped', async () => {
  const t0 = new Date('2026-10-01T10:00:00Z');
  const later = (s) => new Date(t0.getTime() + s * 1000);
  const w = DOWNLOAD_DEDUPE_WINDOW_SECONDS;

  assert.deepEqual(await recordServerMaterialDownload({ material: MATERIAL, userId: 'stu-a', role: 'student', now: t0 }), { recorded: true });
  assert.deepEqual(
    await recordServerMaterialDownload({ material: MATERIAL, userId: 'stu-a', role: 'student', now: later(1) }),
    { recorded: false, reason: 'duplicate' },
    'browser retry within the window is one download',
  );
  await recordServerMaterialDownload({ material: MATERIAL, userId: 'stu-a', role: 'student', now: later(w * 3) });
  await recordServerMaterialDownload({ material: MATERIAL, userId: 'stu-a', role: 'student', now: later(w * 6) });
  await recordServerMaterialDownload({ material: MATERIAL, userId: 'stu-b', role: 'student', now: later(w * 2) });

  assert.equal((await recordServerMaterialDownload({ material: MATERIAL, userId: TEACHER, role: 'instructor', now: t0 })).reason, 'not_student');
  assert.equal((await recordServerMaterialDownload({ material: MATERIAL, userId: TEACHER, role: 'student', now: t0 })).reason, 'owner', 'uploader is never a downloader');
  assert.equal((await recordServerMaterialDownload({ material: MATERIAL, userId: 'adm', role: 'admin', now: t0 })).reason, 'not_student');
  assert.equal((await recordServerMaterialDownload({ material: MATERIAL, userId: 'par', role: 'parent', now: t0 })).reason, 'not_student');

  const rows = [...state.materialAssignments.values()];
  assert.equal(rows.length, 2);
  const summary = summarizeMaterial(rows.map((r) => ({ student_id: r.student_id, ...materialStudentStatus(r) })));
  assert.equal(summary.unique_downloaders, 2);
  assert.equal(summary.total_downloads, 4);
  assert.equal(summary.viewed, 0, 'a download is not a view');
  const logged = state.log.filter((r) => r.event_type === 'material_file_downloaded');
  assert.equal(logged.length, 4);
  assert.ok(logged.every((r) => r.source === 'server' && r.instructor_id === TEACHER && r.group_id === 'g-1'));
});

function seedAssignment(id, sa) {
  state.assignments.set('asg-1', { id: 'asg-1', instructor_id: TEACHER, due_date: '2026-10-05', group_id: null, title: 'HW' });
  state.studentAssignments.set(id, { id, assignment_id: 'asg-1', student_id: 'stu-a', submission_count: 1, seen_at: null, late_decision: null, returned_at: null, first_submitted_at: null, ...sa });
}

test('return for revision: only the owner teacher, only from a submitted/graded state', async () => {
  const now = new Date('2026-10-02T10:00:00Z');
  seedAssignment('sa-pending', { status: 'pending', submitted_at: null, submission_count: 0 });
  await assert.rejects(
    returnAssignmentForRevision({ instructorId: TEACHER, studentAssignmentId: 'sa-pending', now }),
    (e) => e.statusCode === 409 && e.code === 'ASSIGNMENT_NOT_RETURNABLE',
  );
  seedAssignment('sa-1', { status: 'reviewed', submitted_at: '2026-10-01T09:00:00Z', reviewed_at: '2026-10-01T12:00:00Z', score: 7 });
  await assert.rejects(
    returnAssignmentForRevision({ instructorId: OTHER_TEACHER, studentAssignmentId: 'sa-1', now }),
    (e) => e.statusCode === 404,
    'another workspace cannot return it',
  );

  const row = await returnAssignmentForRevision({ instructorId: TEACHER, studentAssignmentId: 'sa-1', feedback: 'Fix Q2', now });
  assert.equal(row.status, 'returned');
  const sa = state.studentAssignments.get('sa-1');
  assert.equal(sa.submitted_at, null);
  assert.equal(sa.score, null);
  assert.equal(sa.first_submitted_at, '2026-10-01T09:00:00Z', 'first submission time is kept');
  const progress = state.assignmentStatus.get('asg-1:stu-a');
  assert.equal(progress.status, 'returned_for_revision');
  const ev = state.log.find((r) => r.event_type === 'assignment_returned');
  assert.ok(ev);
  assert.equal(ev.metadata.previous_status, 'graded');
  assert.equal(ev.metadata.previous_score, 7);
  assert.equal(ev.metadata.actor_id, TEACHER);

  await assert.rejects(
    returnAssignmentForRevision({ instructorId: TEACHER, studentAssignmentId: 'sa-1', now }),
    (e) => e.code === 'ASSIGNMENT_NOT_RETURNABLE',
    'cannot return twice before resubmission',
  );

  // Tələbə yenidən təslim edir (controller: submitted_at = NOW(), submission_count + 1).
  Object.assign(sa, { status: 'submitted', submitted_at: '2026-10-03T08:00:00Z', submission_count: 2 });
  const st = await recordAssignmentActivity('sa-1', 'assignment_submitted', { now: new Date('2026-10-03T08:00:00Z') });
  assert.equal(st.progress_status, 'submitted', 'resubmission goes back to SUBMITTED');
  assert.equal(state.assignmentStatus.get('asg-1:stu-a').submission_count, 2);
  const subs = state.log.filter((r) => r.entity_id === 'asg-1' && r.event_type === 'assignment_submitted');
  assert.deepEqual(subs.map((r) => r.dedupe_key), ['submitted:2']);
  // Eyni hadisə təkrar gəlsə, ikinci jurnal sətri yazılmır.
  await recordAssignmentActivity('sa-1', 'assignment_submitted', { now: new Date('2026-10-03T08:00:05Z') });
  assert.equal(state.log.filter((r) => r.entity_id === 'asg-1' && r.event_type === 'assignment_submitted').length, 1);
});

test('late submission is logged as assignment_late_submitted', async () => {
  state.assignments.set('asg-2', { id: 'asg-2', instructor_id: TEACHER, due_date: '2026-09-20', group_id: null, title: 'Old HW' });
  state.studentAssignments.set('sa-late', {
    id: 'sa-late', assignment_id: 'asg-2', student_id: 'stu-b', status: 'late',
    submitted_at: '2026-09-25T10:00:00Z', first_submitted_at: '2026-09-25T10:00:00Z', submission_count: 1,
  });
  const st = await recordAssignmentActivity('sa-late', 'assignment_submitted', { now: new Date('2026-09-25T10:00:00Z') });
  assert.equal(st.progress_status, 'late_submitted');
  assert.ok(state.log.find((r) => r.entity_id === 'asg-2' && r.event_type === 'assignment_late_submitted'));
});
