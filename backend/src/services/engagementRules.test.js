const test = require('node:test');
const assert = require('node:assert/strict');
const {
  materialKind,
  interpretMaterialEvent,
  materialStudentStatus,
  assignmentStudentStatus,
  summarizeMaterial,
  summarizeAssignment,
  reminderEligible,
  MATERIAL_FILTERS,
  ASSIGNMENT_FILTERS,
} = require('./engagementRules');

const NOW = new Date('2026-09-28T12:00:00Z');

test('materialKind classifies common types', () => {
  assert.equal(materialKind('application/pdf', '/api/materials/file/a.pdf'), 'pdf');
  assert.equal(materialKind('video/mp4', ''), 'video');
  assert.equal(materialKind('', 'https://youtube.com/watch?v=1'), 'link');
  assert.equal(materialKind('application/vnd.openxmlformats-officedocument.presentationml.presentation', 'x.pptx'), 'presentation');
  assert.equal(materialKind('application/msword', 'x.doc'), 'document');
  assert.equal(materialKind('text/plain', 'a.txt'), 'text');
});

test('PDF: a one-second open is not a view; enough active time is', () => {
  const quick = interpretMaterialEvent('pdf', { event_type: 'material_viewed', active_seconds: 1 });
  assert.equal(quick.event_type, 'material_opened');
  assert.equal(quick.viewed, false);
  const real = interpretMaterialEvent('pdf', { event_type: 'material_viewed', active_seconds: 12 });
  assert.equal(real.viewed, true);
  assert.equal(real.completed, true);
});

test('text lesson needs longer reading time than a PDF', () => {
  assert.equal(interpretMaterialEvent('text', { event_type: 'material_viewed', active_seconds: 12 }).viewed, false);
  assert.equal(interpretMaterialEvent('text', { event_type: 'material_viewed', active_seconds: 25 }).viewed, true);
});

test('download counts as viewed for documents', () => {
  const r = interpretMaterialEvent('document', { event_type: 'material_downloaded' });
  assert.equal(r.viewed, true);
  assert.equal(r.downloaded, true);
});

test('video: started ≠ completed; completed needs 80%', () => {
  const started = interpretMaterialEvent('video', { event_type: 'video_started' });
  assert.equal(started.viewed, true);
  assert.equal(started.completed, false);
  const half = interpretMaterialEvent('video', { event_type: 'video_progressed', progress_pct: 50 });
  assert.equal(half.completed, false);
  const fake = interpretMaterialEvent('video', { event_type: 'video_completed', progress_pct: 30 });
  assert.equal(fake.event_type, 'video_progressed');
  assert.equal(fake.completed, false);
  const done = interpretMaterialEvent('video', { event_type: 'video_progressed', progress_pct: 85 });
  assert.equal(done.event_type, 'video_completed');
  assert.equal(done.completed, true);
});

test('external link counts as viewed on click', () => {
  const r = interpretMaterialEvent('link', { event_type: 'material_opened' });
  assert.equal(r.viewed, true);
});

test('unknown or mismatched events are rejected', () => {
  assert.equal(interpretMaterialEvent('pdf', { event_type: 'hacked' }), null);
  assert.equal(interpretMaterialEvent('pdf', { event_type: 'video_started' }), null);
});

test('active seconds are clamped so a forgotten tab cannot inflate time', () => {
  assert.equal(interpretMaterialEvent('pdf', { event_type: 'material_viewed', active_seconds: 999999 }).active_seconds, 1800);
  assert.equal(interpretMaterialEvent('pdf', { event_type: 'material_viewed', active_seconds: -5 }).active_seconds, 0);
});

test('material status: not viewed, opened, viewed, overdue', () => {
  assert.equal(materialStudentStatus(null).status, 'not_opened');
  assert.equal(materialStudentStatus({ first_opened_at: NOW }).status, 'opened');
  assert.equal(materialStudentStatus({ first_opened_at: NOW, first_viewed_at: NOW }).status, 'in_progress');
  assert.equal(materialStudentStatus({ first_opened_at: NOW, first_viewed_at: NOW, completed_at: NOW }).status, 'completed');
  const overdue = materialStudentStatus({ first_opened_at: NOW }, { dueAt: '2026-09-27T00:00:00Z', now: NOW });
  assert.equal(overdue.overdue, true);
  const viewedLate = materialStudentStatus({ first_viewed_at: NOW }, { dueAt: '2026-09-27T00:00:00Z', now: NOW });
  assert.equal(viewedLate.overdue, false);
});

test('duplicate opens count once in the viewed total', () => {
  // Bir tələbə üçün bir status sətri var; neçə dəfə açsa da siyahıda bir dəfə görünür.
  const students = [
    { student_id: 'a', full_name: 'Aysel', ...materialStudentStatus({ first_viewed_at: NOW, completed_at: NOW, last_activity_at: '2026-09-28T11:00:00Z' }) },
    { student_id: 'b', full_name: 'Babək', ...materialStudentStatus({ first_opened_at: NOW, last_activity_at: '2026-09-28T10:00:00Z' }) },
    { student_id: 'c', full_name: 'Cavid', ...materialStudentStatus(null) },
  ];
  const s = summarizeMaterial(students);
  assert.equal(s.assigned, 3);
  assert.equal(s.viewed, 1);
  assert.equal(s.opened_not_viewed, 1);
  assert.equal(s.not_opened, 1);
  assert.equal(s.completion_pct, 33);
  assert.deepEqual(s.recent_viewers.map((v) => v.student_id), ['a']);
  assert.equal(s.last_activity_at, '2026-09-28T11:00:00Z');
});

test('recent viewers are capped at 4 with +N', () => {
  const students = Array.from({ length: 7 }, (_, i) => ({
    student_id: String(i),
    full_name: `S${i}`,
    ...materialStudentStatus({ first_viewed_at: NOW, last_activity_at: `2026-09-28T0${i}:00:00Z` }),
  }));
  const s = summarizeMaterial(students);
  assert.equal(s.recent_viewers.length, 4);
  assert.equal(s.more_viewers, 3);
  assert.equal(s.recent_viewers[0].student_id, '6');
});

test('assignment status: opened, started, submitted, graded are separate', () => {
  assert.equal(assignmentStudentStatus({ status: 'pending' }, null, { now: NOW }).status, 'not_opened');
  assert.equal(assignmentStudentStatus({ status: 'pending', seen_at: NOW }, null, { now: NOW }).status, 'opened');
  assert.equal(assignmentStudentStatus({ status: 'pending' }, { started_at: NOW }, { now: NOW }).status, 'started');
  const submitted = assignmentStudentStatus({ status: 'submitted', submitted_at: NOW }, null, { now: NOW });
  assert.equal(submitted.status, 'submitted');
  assert.equal(submitted.waiting_grading, true);
  const graded = assignmentStudentStatus({ status: 'reviewed', submitted_at: NOW, reviewed_at: NOW, score: 9 }, null, { now: NOW });
  assert.equal(graded.status, 'graded');
  assert.equal(graded.submitted, true);
});

test('assignment overdue uses end of due day in Baku time', () => {
  // due 2026-09-28 → Bakı 23:59:59 = 19:59:59 UTC
  assert.equal(assignmentStudentStatus({ status: 'pending' }, null, { dueDate: '2026-09-28', now: NOW }).overdue, false);
  const late = new Date('2026-09-28T20:30:00Z');
  assert.equal(assignmentStudentStatus({ status: 'pending' }, null, { dueDate: '2026-09-28', now: late }).status, 'overdue');
  assert.equal(
    assignmentStudentStatus({ status: 'late', submitted_at: late }, null, { dueDate: '2026-09-28', now: late }).overdue,
    false,
  );
  assert.equal(
    assignmentStudentStatus({ status: 'late_rejected', submitted_at: late }, null, { dueDate: '2026-09-28', now: late }).status,
    'overdue',
  );
});

test('assignment summary counts', () => {
  const rows = [
    assignmentStudentStatus({ status: 'reviewed', submitted_at: NOW, reviewed_at: NOW }, null, { now: NOW }),
    assignmentStudentStatus({ status: 'submitted', submitted_at: NOW }, null, { now: NOW }),
    assignmentStudentStatus({ status: 'pending' }, null, { dueDate: '2026-09-01', now: NOW }),
    assignmentStudentStatus({ status: 'pending' }, null, { now: NOW }),
  ];
  const s = summarizeAssignment(rows);
  assert.deepEqual(
    { assigned: s.assigned, submitted: s.submitted, graded: s.graded, waiting: s.waiting_grading, not_submitted: s.not_submitted, overdue: s.overdue, not_opened: s.not_opened, pct: s.completion_pct },
    { assigned: 4, submitted: 2, graded: 1, waiting: 1, not_submitted: 2, overdue: 1, not_opened: 1, pct: 50 },
  );
});

test('filters and reminder eligibility', () => {
  const viewed = materialStudentStatus({ first_viewed_at: NOW });
  const notViewed = materialStudentStatus(null);
  assert.equal(MATERIAL_FILTERS.viewed(viewed), true);
  assert.equal(MATERIAL_FILTERS.not_viewed(notViewed), true);
  assert.equal(reminderEligible('material', viewed), false);
  assert.equal(reminderEligible('material', notViewed), true);
  const graded = assignmentStudentStatus({ status: 'reviewed', submitted_at: NOW, reviewed_at: NOW }, null, { now: NOW });
  const overdue = assignmentStudentStatus({ status: 'pending' }, null, { dueDate: '2026-09-01', now: NOW });
  assert.equal(ASSIGNMENT_FILTERS.graded(graded), true);
  assert.equal(ASSIGNMENT_FILTERS.overdue(overdue), true);
  assert.equal(reminderEligible('assignment', graded), false);
  assert.equal(reminderEligible('assignment', overdue), true);
});
