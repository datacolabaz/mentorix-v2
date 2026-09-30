const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  ACTIVITY_EVENTS,
  STORED_EVENT_TYPES,
  nextAssignmentStatus,
  assignmentProgressFromLegacy,
  nextExamStatus,
  countAnsweredQuestions,
  hasAnyAnswer,
  examPersonalDeadline,
  classifySubmission,
  expiredAttemptOutcome,
  examStudentState,
  summarizeExam,
  EXAM_FILTERS,
  examProgressFromLegacy,
  EXPIRY_GRACE_SECONDS,
  PROGRESS_STATUS_LABELS,
} = require('./activityStatusRules');

const NOW = new Date('2026-10-01T10:00:00Z');

test('migration 217 CHECK list equals STORED_EVENT_TYPES and every spec event maps to a stored type', () => {
  const sql = fs.readFileSync(
    path.join(__dirname, '../models/migrations/217_student_activity_log_extend.sql'),
    'utf8',
  );
  const m = sql.match(/student_activity_log_event_type_check\s+CHECK\s*\(\s*event_type\s+IN\s*\(([\s\S]*?)\)\s*\)/i);
  assert.ok(m, 'event_type CHECK found in 217');
  const inSql = [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort();
  assert.deepEqual(inSql, [...STORED_EVENT_TYPES].sort());
  for (const stored of Object.values(ACTIVITY_EVENTS)) {
    assert.ok(STORED_EVENT_TYPES.includes(stored), `${stored} is allowed by the CHECK`);
  }
});

test('migrations 217-220 are additive and safe for boot-time runs', () => {
  const dir = path.join(__dirname, '../models/migrations');
  const files = fs.readdirSync(dir).filter((f) => /^21[7-9]_|^220_/.test(f));
  assert.equal(files.length, 4);
  assert.equal(files.some((f) => f.endsWith('.down.sql')), false, 'no .down.sql in migrations folder');
  for (const f of files) {
    const sql = fs.readFileSync(path.join(dir, f), 'utf8').replace(/--.*$/gm, '');
    assert.equal(/\bBEGIN\b|\bCOMMIT\b/i.test(sql), false, `${f}: no own transaction control`);
    assert.equal(/\bCONCURRENTLY\b/i.test(sql), false, `${f}: no CONCURRENTLY inside the runner transaction`);
    assert.equal(/\bDROP\s+TABLE\b|\bDROP\s+COLUMN\b|\bUPDATE\s+\w+\s+SET\b|\bDELETE\s+FROM\b/i.test(sql), false, `${f}: additive only`);
    for (const stmt of sql.match(/ADD\s+CONSTRAINT[\s\S]*?;/gi) || []) {
      if (/CHECK/i.test(stmt)) assert.match(stmt, /NOT VALID/i, `${f}: CHECK constraints are NOT VALID (no table scan lock)`);
    }
    for (const add of sql.match(/ADD\s+COLUMN\s+(?!IF NOT EXISTS)/gi) || []) {
      assert.fail(`${f}: ADD COLUMN without IF NOT EXISTS: ${add}`);
    }
  }
});

/* ---------------- Assignment transitions ---------------- */

test('assignment transitions: view → start → submit → grade → return → resubmit', () => {
  let s = 'not_opened';
  s = nextAssignmentStatus(s, 'opened').status;
  assert.equal(s, 'viewed');
  s = nextAssignmentStatus(s, 'started').status;
  assert.equal(s, 'in_progress');
  s = nextAssignmentStatus(s, 'submitted').status;
  assert.equal(s, 'submitted');
  s = nextAssignmentStatus(s, 'graded').status;
  assert.equal(s, 'graded');
  const ret = nextAssignmentStatus(s, 'returned');
  assert.equal(ret.valid, true);
  assert.equal(ret.status, 'returned_for_revision');
  s = ret.status;
  assert.equal(nextAssignmentStatus(s, 'graded').valid, false, 'cannot grade before resubmission');
  s = nextAssignmentStatus(s, 'submitted').status;
  assert.equal(s, 'submitted', 'resubmission goes back to SUBMITTED');
});

test('assignment: late submission, returns only from submitted states, repeat events are no-ops', () => {
  assert.equal(nextAssignmentStatus('overdue', 'submitted', { late: true }).status, 'late_submitted');
  assert.equal(nextAssignmentStatus('late_submitted', 'returned').status, 'returned_for_revision');
  for (const from of ['not_opened', 'viewed', 'in_progress', 'overdue', 'returned_for_revision']) {
    assert.equal(nextAssignmentStatus(from, 'returned').valid, false, `cannot return from ${from}`);
  }
  const again = nextAssignmentStatus('submitted', 'submitted');
  assert.equal(again.status, 'submitted');
  assert.equal(again.changed, false);
  assert.equal(nextAssignmentStatus('graded', 'opened').status, 'graded', 'opening again does not regress');
  assert.equal(nextAssignmentStatus('submitted', 'late_rejected').status, 'overdue');
  assert.equal(nextAssignmentStatus('viewed', 'bogus').valid, false);
});

test('assignment legacy mapping', () => {
  assert.equal(assignmentProgressFromLegacy({ status: 'reviewed', submitted_at: NOW }), 'graded');
  assert.equal(assignmentProgressFromLegacy({ status: 'late', submitted_at: NOW }), 'late_submitted');
  assert.equal(assignmentProgressFromLegacy({ status: 'returned' }), 'returned_for_revision');
  assert.equal(assignmentProgressFromLegacy({ status: 'pending' }, { started_at: NOW }), 'in_progress');
  assert.equal(assignmentProgressFromLegacy({ status: 'pending', seen_at: NOW }), 'viewed');
  assert.equal(assignmentProgressFromLegacy({ status: 'pending' }), 'not_opened');
});

/* ---------------- Exam transitions / expiry ---------------- */

test('exam status moves forward only; repeats do not regress', () => {
  let s = nextExamStatus('not_started', 'viewed');
  assert.equal(s, 'viewed');
  s = nextExamStatus(s, 'started');
  assert.equal(s, 'in_progress');
  assert.equal(nextExamStatus(s, 'viewed'), 'in_progress');
  assert.equal(nextExamStatus(s, 'submitted'), 'completed');
  assert.equal(nextExamStatus(s, 'submitted', { released: true }), 'result_released');
  assert.equal(nextExamStatus(s, 'submitted', { gradingPending: true, released: true }), 'pending_manual_grading');
  assert.equal(nextExamStatus('completed', 'submitted'), 'completed', 'double submit is a no-op');
  assert.equal(nextExamStatus('completed', 'started'), 'completed');
  assert.equal(nextExamStatus('completed', 'result_released'), 'result_released');
});

test('exam expiry: auto-submitted vs no answers, grading and release afterwards', () => {
  assert.equal(nextExamStatus('in_progress', 'auto_submitted'), 'expired_auto_submitted');
  assert.equal(nextExamStatus('in_progress', 'expired_no_answers'), 'expired_no_answers');
  assert.equal(nextExamStatus('completed', 'expired_no_answers'), 'completed', 'finalized attempt cannot expire');
  assert.equal(nextExamStatus('in_progress', 'auto_submitted', { gradingPending: true }), 'pending_manual_grading');
  assert.equal(nextExamStatus('pending_manual_grading', 'grading_confirmed', { autoSubmitted: true }), 'expired_auto_submitted');
  assert.equal(nextExamStatus('pending_manual_grading', 'grading_confirmed', { released: true }), 'result_released');
  assert.equal(nextExamStatus('expired_auto_submitted', 'result_released'), 'result_released');
  assert.equal(nextExamStatus('expired_no_answers', 'result_released'), 'expired_no_answers');
  assert.equal(nextExamStatus('expired_no_answers', 'voided'), 'not_started', 'late access voids the empty attempt');
  assert.equal(nextExamStatus('completed', 'voided'), 'completed', 'answered attempts are never voided');
});

test('answers: empty values do not count as answered', () => {
  assert.equal(countAnsweredQuestions(null), 0);
  assert.equal(countAnsweredQuestions({ a: '', b: '  ', c: null, d: [], e: {} }), 0);
  assert.equal(countAnsweredQuestions({ a: 'A', b: '', c: ['x'], d: { 1: 'b' }, e: 0 }), 4);
  assert.equal(countAnsweredQuestions('{"q1":"B"}'), 1);
  assert.equal(countAnsweredQuestions('not json'), 0);
  assert.equal(hasAnyAnswer({ q: '' }), false);
  assert.equal(expiredAttemptOutcome({ q: 'A' }), 'expired_auto_submitted');
  assert.equal(expiredAttemptOutcome({}), 'expired_no_answers');
});

test('submission classification around the personal deadline', () => {
  const started = new Date('2026-10-01T09:00:00Z');
  const deadline = examPersonalDeadline(started, 30);
  assert.equal(deadline.toISOString(), '2026-10-01T09:30:00.000Z');
  assert.equal(examPersonalDeadline(started, 0), null);
  assert.equal(examPersonalDeadline(started, 0, { minimumMinutes: 1 }).toISOString(), '2026-10-01T09:01:00.000Z');
  const at = (sec) => new Date(deadline.getTime() + sec * 1000);
  assert.deepEqual(classifySubmission({ deadline, now: at(-600) }), { accept: true, kind: 'manual' });
  assert.deepEqual(classifySubmission({ deadline, now: at(-600), clientAutoSubmit: true }), { accept: true, kind: 'manual' });
  assert.deepEqual(classifySubmission({ deadline, now: at(-3), clientAutoSubmit: true }), { accept: true, kind: 'auto_expired' });
  assert.deepEqual(classifySubmission({ deadline, now: at(20), clientAutoSubmit: true }), { accept: true, kind: 'auto_expired' });
  assert.deepEqual(classifySubmission({ deadline, now: at(EXPIRY_GRACE_SECONDS + 1) }), { accept: false, kind: 'too_late' });
  assert.deepEqual(classifySubmission({ deadline: null, now: NOW }), { accept: true, kind: 'manual' });
});

/* ---------------- Exam aggregates ---------------- */

function examRows() {
  return [
    // completed, scored 80
    { student_id: 'a', full_name: 'A', status: 'result_released', started_at: '2026-10-01T09:00:00Z', completed_at: '2026-10-01T09:20:00Z', result_released_at: '2026-10-01T09:20:00Z', score: 80 },
    // auto-submitted with answers, scored 40
    { student_id: 'b', full_name: 'B', status: 'expired_auto_submitted', started_at: '2026-10-01T08:00:00Z', completed_at: '2026-10-01T08:30:00Z', expired_at: '2026-10-01T08:30:00Z', score: 40 },
    // expired with no answers → excluded from the average
    { student_id: 'c', full_name: 'C', status: 'expired_no_answers', started_at: '2026-10-01T08:00:00Z', expired_at: '2026-10-01T08:30:00Z', result_status: 'expired', score: 0 },
    // pending manual grading → excluded from the average
    { student_id: 'd', full_name: 'D', status: 'pending_manual_grading', started_at: '2026-10-01T09:00:00Z', completed_at: '2026-10-01T09:25:00Z', score: 10 },
    // in progress, active 2 minutes ago
    { student_id: 'e', full_name: 'E', status: 'in_progress', started_at: '2026-10-01T09:50:00Z', latest_activity_at: '2026-10-01T09:58:00Z' },
    // in progress but inactive for 30 minutes
    { student_id: 'f', full_name: 'F', status: 'in_progress', started_at: '2026-10-01T09:20:00Z', latest_activity_at: '2026-10-01T09:30:00Z' },
    // viewed only
    { student_id: 'g', full_name: 'G', status: 'viewed', viewed_at: '2026-10-01T09:00:00Z' },
    // assigned, nothing yet
    { student_id: 'h', full_name: 'H' },
    // voided attempt (late access granted) → counts as not started; its score is ignored
    { student_id: 'i', full_name: 'I', result_status: 'voided', result_started_at: '2026-10-01T07:00:00Z', result_submitted_at: '2026-10-01T07:30:00Z', score: 100 },
  ];
}

test('exam per-student states use honest labels', () => {
  const byId = Object.fromEntries(examRows().map((r) => [r.student_id, examStudentState(r, { now: NOW })]));
  assert.equal(byId.a.status, 'completed');
  assert.equal(byId.a.released, true);
  assert.equal(byId.b.status, 'expired_auto_submitted');
  assert.equal(byId.c.status, 'expired_no_answers');
  assert.equal(byId.d.status, 'pending_manual_grading');
  assert.equal(byId.e.status, 'in_progress');
  assert.equal(byId.f.status, 'inactive');
  assert.equal(byId.g.status, 'viewed');
  assert.equal(byId.h.status, 'not_started');
  assert.equal(byId.i.status, 'not_started');
  for (const lang of ['az', 'en']) {
    for (const s of Object.values(byId)) assert.ok(PROGRESS_STATUS_LABELS[lang][s.status], `${lang} label for ${s.status}`);
    assert.equal(Object.values(PROGRESS_STATUS_LABELS[lang]).some((l) => /abandon|tərk/i.test(l)), false);
  }
});

test('no-answer, pending and voided attempts are excluded from the average', () => {
  const students = examRows().map((r) => ({ student_id: r.student_id, full_name: r.full_name, ...examStudentState(r, { now: NOW }) }));
  const s = summarizeExam(students);
  assert.equal(s.scored_count, 2);
  assert.equal(s.average_score, 60, '(80 + 40) / 2');
  assert.equal(s.assigned, 9);
  assert.equal(s.completed, 3);
  assert.equal(s.auto_submitted, 1);
  assert.equal(s.expired_no_answers, 1);
  assert.equal(s.expired, 2);
  assert.equal(s.pending_manual_grading, 1);
  assert.equal(s.in_progress, 1);
  assert.equal(s.inactive, 1);
  assert.equal(s.viewed, 7);
  assert.equal(s.not_started, 3, 'viewed-only, untouched and voided');
  assert.equal(s.result_released, 1);
});

test('exam dashboard aggregates equal counts over the detail rows', () => {
  const students = examRows().map((r) => ({ student_id: r.student_id, full_name: r.full_name, ...examStudentState(r, { now: NOW }) }));
  const card = summarizeExam(students);
  const detailCount = (filter) => students.filter(EXAM_FILTERS[filter]).length;
  assert.equal(card.viewed, detailCount('viewed'));
  assert.equal(card.started, detailCount('started'));
  assert.equal(card.not_started, detailCount('not_started'));
  assert.equal(card.in_progress, detailCount('in_progress'));
  assert.equal(card.inactive, detailCount('inactive'));
  assert.equal(card.completed, detailCount('completed'));
  assert.equal(card.expired, detailCount('expired'));
  assert.equal(card.pending_manual_grading, detailCount('pending_manual_grading'));
  assert.equal(card.assigned, detailCount('viewed') + detailCount('not_viewed'));
});

test('exam backfill mapping from legacy attempts', () => {
  assert.equal(examProgressFromLegacy({}).status, 'not_started');
  assert.equal(examProgressFromLegacy({ result: { id: 'r', status: 'voided', submitted_at: NOW } }).status, 'not_started');
  const open = examProgressFromLegacy({ result: { id: 'r', status: 'in_progress', started_at: NOW, answers: { q: 'A' } } });
  assert.equal(open.status, 'in_progress');
  assert.equal(open.answered_question_count, 1);
  const expired = examProgressFromLegacy({
    result: { id: 'r', status: 'expired', started_at: '2026-10-01T09:00:00Z' },
    durationMinutes: 30,
  });
  assert.equal(expired.status, 'expired_no_answers');
  assert.equal(new Date(expired.expired_at).toISOString(), '2026-10-01T09:30:00.000Z');
  const done = examProgressFromLegacy({
    result: { id: 'r', status: 'completed', started_at: '2026-10-01T09:00:00Z', submitted_at: '2026-10-01T09:20:00Z' },
    released: true,
    attemptCount: 1,
    totalQuestions: 10,
  });
  assert.equal(done.status, 'result_released');
  assert.equal(done.total_question_count, 10);
  const pending = examProgressFromLegacy({
    result: { id: 'r', status: 'completed', submitted_at: '2026-10-01T09:20:00Z' },
    gradingPending: true,
    released: true,
  });
  assert.equal(pending.status, 'pending_manual_grading');
});
