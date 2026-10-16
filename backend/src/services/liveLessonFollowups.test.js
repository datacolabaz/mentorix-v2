const test = require('node:test');
const assert = require('node:assert/strict');

/**
 * Live lesson: topic field, and materials / tasks / exams the teacher adds after the lesson.
 * DB, notifications and participant-group helpers are stubbed; ownership and visibility rules are asserted
 * through the SQL parameters the service sends.
 */

const U = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const TEACHER = U(1);
const OTHER_TEACHER = U(2);
const STUDENT_A = U(10);
const STUDENT_B = U(11);
const ROOM = U(70);
const MATERIAL = U(80);
const TASK = U(81);
const EXAM = U(82);
const FOREIGN_EXAM = U(83);

const state = {};
function reset() {
  state.room = {
    id: ROOM, room_code: 'MX-ABC234', instructor_id: TEACHER, group_id: U(50), student_id: null, title: 'Riyaziyyat',
    status: 'ended', provider: 'zoom', join_url: 'https://zoom.us/j/123', scheduled_at: new Date(Date.now() - 3 * 3600e3).toISOString(),
    duration_minutes: 60, notify_email: true, materials: [], topic: 'Törəmə',
  };
  state.owned = { material: new Set([MATERIAL]), task: new Set([TASK]), exam: new Set([EXAM]) };
  state.followups = [];
  state.assigned = [];
  state.calls = [];
  state.participant = [];
}
reset();

const titles = { [MATERIAL]: 'Konspekt.pdf', [TASK]: 'Ev tapşırığı 3', [EXAM]: 'Mini test' };

const fakeDb = {
  query: async (sql, params = []) => {
    if (/FROM live_rooms lr\s+JOIN users u ON u\.id = lr\.instructor_id/.test(sql) && /WHERE lr\.id = \$1/.test(sql)) {
      return { rows: params[0] === ROOM ? [state.room] : [] };
    }
    const own = sql.match(/FROM (course_materials|assignments|exams) WHERE id = \$1 AND instructor_id = \$2/);
    if (own) {
      const kind = { course_materials: 'material', assignments: 'task', exams: 'exam' }[own[1]];
      const ok = params[1] === TEACHER && state.owned[kind].has(params[0]);
      return { rows: ok ? [{ title: titles[params[0]] }] : [] };
    }
    if (/SELECT COUNT\(\*\)::int AS n FROM live_lesson_followups/.test(sql)) return { rows: [{ n: state.followups.length }] };
    if (/SELECT DISTINCT e\.student_id FROM enrollments e/.test(sql)) return { rows: [{ student_id: STUDENT_A }, { student_id: STUDENT_B }] };
    if (/INSERT INTO live_lesson_followups/.test(sql)) {
      const [roomId, kind, refId] = params;
      if (state.followups.some((f) => f.room_id === roomId && f.kind === kind && f.ref_id === refId)) return { rows: [] };
      const id = U(300 + state.followups.length);
      state.followups.push({ id, room_id: roomId, kind, ref_id: refId, created_at: new Date().toISOString() });
      return { rows: [{ id }] };
    }
    if (/INSERT INTO exam_assignments/.test(sql)) {
      state.assigned.push(['exam', ...params]);
      return { rows: [] };
    }
    if (/INSERT INTO student_assignments/.test(sql)) {
      state.assigned.push(['task', ...params]);
      return { rows: [] };
    }
    if (/FROM live_lesson_followups f/.test(sql)) {
      let list = state.followups.filter((f) => f.room_id === params[0]);
      if (params[1]) {
        // student filter: tasks/exams only when assigned to this student
        list = list.filter((f) => f.kind === 'material' || state.assigned.some((a) => a[0] === f.kind && a[1] === f.ref_id && a[2] === params[1]));
      }
      return { rows: list.map((f) => ({ ...f, title: titles[f.ref_id] })) };
    }
    if (/DELETE FROM live_lesson_followups/.test(sql)) {
      const before = state.followups.length;
      state.followups = state.followups.filter((f) => !(f.id === params[0] && f.room_id === params[1]));
      return { rowCount: before - state.followups.length, rows: [] };
    }
    if (/SELECT full_name FROM users/.test(sql)) return { rows: [{ full_name: 'Aynur' }] };
    if (/FROM live_lesson_attendance/.test(sql)) return { rows: [] };
    if (/SELECT 1 FROM live_rooms lr WHERE lr\.id = \$2/.test(sql)) return { rows: [params[0] === STUDENT_A ? { ok: 1 } : null].filter(Boolean) };
    throw new Error(`unexpected SQL: ${sql.slice(0, 90)}`);
  },
  transaction: async (fn) => fn(fakeDb),
};

const stub = (rel, exports) => {
  const id = require.resolve(rel);
  require.cache[id] = { id, filename: id, loaded: true, exports };
};
stub('../utils/db', fakeDb);
stub('./notificationService', {
  createNotificationSafe: async (input) => {
    state.calls.push(input);
    return { created: true };
  },
});
stub('./participantGroupService', {
  addStudentToExamParticipantGroup: async (_c, examId, sid) => state.participant.push(['exam', examId, sid]),
  addStudentToAssignmentParticipantGroup: async (_c, taskId, sid) => state.participant.push(['task', taskId, sid]),
});

const svc = require('./liveLessonService');

test('topic is validated, trimmed and optional', () => {
  const ymd = new Date(Date.now() + 30 * 3600e3 + 4 * 3600e3).toISOString().slice(0, 10);
  const body = {
    title: 'Fizika', topic: '  Nyuton qanunları  ', group_id: U(50), date: ymd, start_time: '18:00', end_time: '19:00',
    platform: 'zoom', meeting_url: 'https://zoom.us/j/123456789',
  };
  assert.equal(svc.validateLessonInput(body).topic, 'Nyuton qanunları');
  assert.equal(svc.validateLessonInput({ ...body, topic: '' }).topic, null);
  assert.equal(svc.validateLessonInput({ ...body, topic: 'x'.repeat(400) }).topic.length, 255);
  assert.deepEqual(svc.validateLessonInput({ topic: 'Yeni' }, { partial: true }), { topic: 'Yeni' });
  assert.equal(svc.mapLesson({ ...state.room, topic: 'Törəmə' }).topic, 'Törəmə');
});

test('teacher adds a material after the lesson: students are notified, no assignment rows', async () => {
  reset();
  const out = await svc.addFollowup(TEACHER, ROOM, { kind: 'material', ref_id: MATERIAL });
  assert.equal(out.added, true);
  assert.equal(out.assigned, 0);
  assert.deepEqual(out.followups.map((f) => [f.kind, f.title]), [['material', 'Konspekt.pdf']]);
  assert.deepEqual(state.assigned, []);
  const notes = state.calls.filter((c) => c.eventType === 'live_lesson_followup');
  assert.deepEqual(notes.map((c) => c.recipientId).sort(), [STUDENT_A, STUDENT_B]);
  assert.equal(notes[0].params.itemTitle, 'Konspekt.pdf');
  assert.equal(notes[0].params.itemKind, 'material');
});

test('adding a task or exam assigns it to the lesson roster (idempotent, no double notification)', async () => {
  reset();
  const exam = await svc.addFollowup(TEACHER, ROOM, { kind: 'exam', ref_id: EXAM });
  assert.equal(exam.assigned, 2);
  assert.deepEqual(state.assigned.map((a) => a.slice(0, 3)), [['exam', EXAM, STUDENT_A], ['exam', EXAM, STUDENT_B]]);
  assert.equal(state.participant.length, 2);
  const task = await svc.addFollowup(TEACHER, ROOM, { kind: 'task', ref_id: TASK });
  assert.equal(task.assigned, 2);
  const callsBefore = state.calls.length;
  const again = await svc.addFollowup(TEACHER, ROOM, { kind: 'task', ref_id: TASK });
  assert.equal(again.added, false);
  assert.equal(state.calls.length, callsBefore, 'duplicate does not re-notify');
  assert.equal(state.followups.length, 2);
});

test('assign=false only links the exam; students then do not see it', async () => {
  reset();
  await svc.addFollowup(TEACHER, ROOM, { kind: 'exam', ref_id: EXAM, assign: false });
  assert.deepEqual(state.assigned, []);
  const asStudent = await svc.listFollowupsForUser({ id: STUDENT_A, role: 'student' }, state.room);
  assert.deepEqual(asStudent, []);
  const asOwner = await svc.listFollowupsForUser({ id: TEACHER, role: 'instructor' }, state.room);
  assert.equal(asOwner.length, 1);
});

test('only own items, only own lessons, never on cancelled lessons', async () => {
  reset();
  await assert.rejects(svc.addFollowup(TEACHER, ROOM, { kind: 'exam', ref_id: FOREIGN_EXAM }), (e) => e.status === 404 && e.code === 'REF_NOT_FOUND');
  await assert.rejects(svc.addFollowup(OTHER_TEACHER, ROOM, { kind: 'exam', ref_id: EXAM }), (e) => e.status === 404);
  await assert.rejects(svc.addFollowup(TEACHER, ROOM, { kind: 'video', ref_id: EXAM }), (e) => e.status === 400);
  await assert.rejects(svc.addFollowup(TEACHER, ROOM, { kind: 'exam', ref_id: 'not-a-uuid' }), (e) => e.status === 400);
  state.room = { ...state.room, status: 'cancelled' };
  await assert.rejects(svc.addFollowup(TEACHER, ROOM, { kind: 'material', ref_id: MATERIAL }), (e) => e.status === 409);
  assert.equal(state.followups.length, 0);
  assert.equal(state.calls.length, 0);
});

test('students of the lesson see follow-ups on the lesson page; parents and outsiders get nothing', async () => {
  reset();
  await svc.addFollowup(TEACHER, ROOM, { kind: 'material', ref_id: MATERIAL });
  await svc.addFollowup(TEACHER, ROOM, { kind: 'task', ref_id: TASK });
  const page = await svc.getLessonForUser({ id: STUDENT_A, role: 'student' }, { id: ROOM });
  assert.deepEqual(page.followups.map((f) => f.kind).sort(), ['material', 'task']);
  assert.equal(page.topic, 'Törəmə');
  assert.deepEqual(await svc.listFollowupsForUser({ id: U(99), role: 'parent' }, state.room), []);
  await assert.rejects(svc.getLessonForUser({ id: STUDENT_B + 'x', role: 'student' }, { id: ROOM }), (e) => e.status === 404);
});

test('removing a follow-up unlinks it only for the owner', async () => {
  reset();
  const { followups } = await svc.addFollowup(TEACHER, ROOM, { kind: 'material', ref_id: MATERIAL });
  await assert.rejects(svc.removeFollowup(OTHER_TEACHER, ROOM, followups[0].id), (e) => e.status === 404);
  const out = await svc.removeFollowup(TEACHER, ROOM, followups[0].id);
  assert.deepEqual(out.followups, []);
  await assert.rejects(svc.removeFollowup(TEACHER, ROOM, followups[0].id), (e) => e.status === 404);
});
