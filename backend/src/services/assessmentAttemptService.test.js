const test = require('node:test');
const assert = require('node:assert/strict');

/* ------------------------------------------------------------------ */
/* In-memory fake for the queries used by assessmentAttemptService     */
/* ------------------------------------------------------------------ */

function createFakeDb() {
  const s = {
    exams: new Map(),
    questions: new Map(),
    results: new Map(),
    progress: new Map(),
    log: [],
    assignments: new Set(),
    onBeforeFinalizeUpdate: null,
  };
  const pkey = (examId, studentId) => `${examId}:${studentId}`;

  function applyProgressSets(row, setsSql, params) {
    const parts = setsSql.split(/,\s*(?=[a-z_]+ = )/);
    for (const part of parts) {
      const [col, expr] = part.split(/ = (.+)/s);
      const val = (n) => params[Number(n) - 1];
      let m;
      if ((m = expr.match(/^\$(\d+)$/))) row[col] = val(m[1]);
      else if ((m = expr.match(/^COALESCE\([a-z_]+, \$(\d+)\)$/))) row[col] = row[col] ?? val(m[1]);
      else if ((m = expr.match(/^GREATEST\(COALESCE\([a-z_]+, \$(\d+)\), \$\d+\)$/))) {
        const v = val(m[1]);
        row[col] = row[col] && new Date(row[col]) > new Date(v) ? row[col] : v;
      } else if (expr === 'NULL') row[col] = null;
      else if (expr === '0') row[col] = 0;
      else if (expr === 'attempt_count + 1') row[col] = (row[col] || 0) + 1;
      else if (expr === 'NOW()') row[col] = new Date();
      else throw new Error(`fake db: unsupported SET ${part}`);
    }
  }

  async function query(sql, params = []) {
    if (/SELECT id, instructor_id FROM exams WHERE id = \$1/.test(sql)) {
      const e = s.exams.get(params[0]);
      return { rows: e ? [{ id: e.id, instructor_id: e.instructor_id }] : [] };
    }
    if (/SELECT \* FROM exam_questions WHERE exam_id = \$1/.test(sql)) {
      return { rows: s.questions.get(params[0]) || [] };
    }
    if (/FROM exam_results er\s+JOIN exams e ON e.id = er.exam_id\s+WHERE er.id = \$1\s+FOR UPDATE OF er/.test(sql)) {
      const r = s.results.get(params[0]);
      if (!r) return { rows: [] };
      return { rows: [{ ...s.exams.get(r.exam_id), ...r, id: r.id }] };
    }
    if (/UPDATE exam_results SET status = 'expired'/.test(sql)) {
      if (s.onBeforeFinalizeUpdate) s.onBeforeFinalizeUpdate();
      const r = s.results.get(params[0]);
      if (!r || r.submitted_at || (r.status || 'in_progress') !== 'in_progress') return { rows: [] };
      r.status = 'expired';
      return { rows: [{ id: r.id }] };
    }
    if (/UPDATE exam_results\s+SET score = \$2/.test(sql)) {
      if (s.onBeforeFinalizeUpdate) s.onBeforeFinalizeUpdate();
      const r = s.results.get(params[0]);
      if (!r || r.submitted_at || (r.status || 'in_progress') !== 'in_progress') return { rows: [] };
      Object.assign(r, {
        score: params[1],
        answers: JSON.parse(params[2]),
        grading: JSON.parse(params[3]),
        status: 'completed',
        submitted_at: params[4],
        duration_seconds: params[5],
        is_crm_student: params[6],
      });
      return { rows: [{ id: r.id }] };
    }
    if (/UPDATE exam_results SET status = 'voided'/.test(sql)) {
      const out = [];
      for (const r of s.results.values()) {
        if (r.exam_id === params[0] && r.student_id === params[1] && !r.submitted_at && r.status === 'expired') {
          r.status = 'voided';
          out.push({ id: r.id });
        }
      }
      return { rows: out };
    }
    if (/UPDATE exam_results er\s+SET answers = \$3::jsonb/.test(sql)) {
      const [examId, studentId, json, tol] = params;
      const open = [...s.results.values()]
        .filter((r) => r.exam_id === examId && r.student_id === studentId && !r.submitted_at && (r.status || 'in_progress') === 'in_progress')
        .sort((a, b) => new Date(b.started_at) - new Date(a.started_at))[0];
      if (!open) return { rows: [] };
      const e = s.exams.get(examId);
      const deadline = new Date(new Date(open.started_at).getTime() + Math.max(e.duration_minutes, 1) * 60000 + tol * 1000);
      if (e.duration_minutes > 0 && deadline < new Date()) return { rows: [] };
      open.answers = JSON.parse(json);
      return { rows: [{ id: open.id }] };
    }
    if (/SELECT 1 FROM exam_assignments WHERE exam_id = \$1 AND student_id = \$2/.test(sql)) {
      const assigned = s.assignments.has(pkey(params[0], params[1]));
      const hasResult = [...s.results.values()].some((r) => r.exam_id === params[0] && r.student_id === params[1]);
      return { rows: assigned || hasResult ? [{ '?column?': 1 }] : [] };
    }
    if (/INSERT INTO exam_student_progress \(exam_id, student_id\) VALUES/.test(sql)) {
      const k = pkey(params[0], params[1]);
      if (!s.progress.has(k)) {
        s.progress.set(k, { exam_id: params[0], student_id: params[1], status: 'not_started', attempt_count: 0, answered_question_count: 0 });
      }
      return { rows: [] };
    }
    if (/SELECT status, expired_at FROM exam_student_progress/.test(sql)) {
      const p = s.progress.get(pkey(params[0], params[1]));
      return { rows: p ? [{ status: p.status, expired_at: p.expired_at || null }] : [] };
    }
    if (/UPDATE exam_student_progress SET (.+) WHERE exam_id = \$1 AND student_id = \$2/s.test(sql)) {
      const sets = sql.match(/UPDATE exam_student_progress SET (.+) WHERE exam_id = \$1/s)[1];
      applyProgressSets(s.progress.get(pkey(params[0], params[1])), sets, params);
      return { rows: [] };
    }
    if (/INSERT INTO student_activity_log/.test(sql)) {
      const [studentId, instructorId, entityType, entityId, eventType, metadata, groupId, dedupeKey] = params;
      if (dedupeKey && s.log.some((r) => r.entity_type === entityType && r.entity_id === entityId && r.student_id === studentId && r.dedupe_key === dedupeKey)) {
        return { rows: [] };
      }
      s.log.push({ student_id: studentId, instructor_id: instructorId, entity_type: entityType, entity_id: entityId, event_type: eventType, metadata: JSON.parse(metadata), group_id: groupId, dedupe_key: dedupeKey });
      return { rows: [{ id: s.log.length }] };
    }
    if (/SELECT er.id\s+FROM exam_results er\s+JOIN exams e/.test(sql)) {
      const [grace, limit, lookbackHours] = params;
      const now = Date.now();
      const ids = [...s.results.values()]
        .filter((r) => {
          const e = s.exams.get(r.exam_id);
          if (r.submitted_at || r.status !== 'in_progress' || !r.started_at || !(e.duration_minutes > 0)) return false;
          const started = new Date(r.started_at).getTime();
          return started + e.duration_minutes * 60000 + grace * 1000 < now && started > now - lookbackHours * 3600000;
        })
        .slice(0, limit)
        .map((r) => ({ id: r.id }));
      return { rows: ids };
    }
    if (/FROM exam_results er JOIN exams e ON e.id = er.exam_id\s+WHERE er.id = \$1 AND er.submitted_at IS NOT NULL/.test(sql)) {
      const r = s.results.get(params[0]);
      if (!r || !r.submitted_at) return { rows: [] };
      return { rows: [{ ...s.exams.get(r.exam_id), ...r, id: r.id }] };
    }
    throw new Error(`fake db: unexpected SQL: ${sql.replace(/\s+/g, ' ').slice(0, 100)}`);
  }

  return { state: s, db: { query, transaction: async (cb) => cb({ query }) } };
}

function hookRecorder() {
  const calls = [];
  const rec = (name) => (payload) => calls.push({ name, payload });
  return {
    calls,
    hooks: {
      onAssessmentSubmitted: rec('submitted'),
      onAssessmentAutoSubmitted: rec('auto_submitted'),
      onAssessmentExpiredNoAnswers: rec('expired_no_answers'),
      onResultReleased: rec('result_released'),
    },
  };
}

const { createAssessmentAttemptService } = require('./assessmentAttemptService');
const { examStudentState, summarizeExam } = require('./activityStatusRules');

const EXAM = { id: 'exam-1', instructor_id: 'teacher-1', duration_minutes: 30, wrong_penalty_enabled: true, show_results: true };

function setup({ pending = false, released = true } = {}) {
  const fake = createFakeDb();
  fake.state.exams.set(EXAM.id, { ...EXAM });
  fake.state.questions.set(EXAM.id, [
    { id: 'q1', points: 5, correct_answer: 'A' },
    { id: 'q2', points: 5, correct_answer: 'B' },
  ]);
  const { calls, hooks } = hookRecorder();
  const afterAuto = [];
  const svc = createAssessmentAttemptService({
    db: fake.db,
    hooks,
    grade: (questions, answers) => {
      const score = questions.reduce((sum, q) => sum + (answers[q.id] === q.correct_answer ? Number(q.points) : 0), 0);
      return { grading: {}, score };
    },
    gradingPending: () => pending,
    needsAiGrading: () => false,
    resultView: async () => ({ released }),
    isCrmStudent: async () => true,
    afterAutoSubmit: (x) => afterAuto.push(x),
  });
  return { fake, svc, calls, afterAuto };
}

function addAttempt(fake, { id, studentId, startedAt, answers = null, status = 'in_progress', submittedAt = null }) {
  fake.state.results.set(id, { id, exam_id: EXAM.id, student_id: studentId, started_at: startedAt, answers, status, submitted_at: submittedAt, score: null });
  fake.state.assignments.add(`${EXAM.id}:${studentId}`);
}

const minutesAgo = (m) => new Date(Date.now() - m * 60000);

test('expiry with answers auto-submits and grades the stored answers', async () => {
  const { fake, svc, calls, afterAuto } = setup();
  addAttempt(fake, { id: 'r1', studentId: 'stu-a', startedAt: minutesAgo(40), answers: { q1: 'A', q2: 'C' } });
  const res = await svc.finalizeExpiredAttempt('r1', { now: new Date() });
  assert.equal(res.finalized, true);
  assert.equal(res.outcome, 'expired_auto_submitted');
  const r = fake.state.results.get('r1');
  assert.equal(r.status, 'completed');
  assert.equal(r.score, 5, 'answers were kept and graded, not wiped');
  assert.deepEqual(r.answers, { q1: 'A', q2: 'C' });
  const deadline = new Date(new Date(r.started_at).getTime() + 30 * 60000);
  assert.equal(new Date(r.submitted_at).getTime(), deadline.getTime(), 'submitted at the personal deadline');
  assert.equal(r.duration_seconds, 30 * 60);
  const p = fake.state.progress.get('exam-1:stu-a');
  assert.equal(p.status, 'result_released');
  assert.ok(p.expired_at, 'expired_at marks it as auto-submitted');
  assert.equal(p.answered_question_count, 2);
  const types = fake.state.log.map((l) => l.event_type).sort();
  assert.deepEqual(types, ['exam_expired', 'exam_result_released', 'exam_submitted']);
  assert.equal(fake.state.log.find((l) => l.event_type === 'exam_expired').metadata.outcome, 'auto_submitted');
  assert.equal(afterAuto.length, 1);
  assert.deepEqual(calls.map((c) => c.name).sort(), ['auto_submitted', 'result_released']);
  assert.equal(examStudentState({ ...p, score: r.score, result_status: r.status }).status, 'expired_auto_submitted');
});

test('expiry without answers is EXPIRED_NO_ANSWERS and nothing is graded', async () => {
  const { fake, svc, calls, afterAuto } = setup();
  addAttempt(fake, { id: 'r2', studentId: 'stu-b', startedAt: minutesAgo(45), answers: { q1: '', q2: null } });
  const res = await svc.finalizeExpiredAttempt('r2');
  assert.equal(res.outcome, 'expired_no_answers');
  const r = fake.state.results.get('r2');
  assert.equal(r.status, 'expired');
  assert.equal(r.submitted_at, null, 'not a submitted result: excluded from results, averages and certificates');
  assert.equal(r.score, null);
  assert.equal(fake.state.progress.get('exam-1:stu-b').status, 'expired_no_answers');
  assert.deepEqual(fake.state.log.map((l) => l.event_type), ['exam_expired']);
  assert.equal(afterAuto.length, 0);
  assert.deepEqual(calls.map((c) => c.name), ['expired_no_answers']);
});

test('finalization is idempotent: a second run changes nothing and emits nothing', async () => {
  const { fake, svc, calls } = setup();
  addAttempt(fake, { id: 'r3', studentId: 'stu-c', startedAt: minutesAgo(40), answers: { q1: 'A' } });
  await svc.finalizeExpiredAttempt('r3');
  const logCount = fake.state.log.length;
  const hookCount = calls.length;
  const again = await svc.finalizeExpiredAttempt('r3');
  assert.equal(again.finalized, false);
  assert.equal(again.reason, 'already_final');
  assert.equal(fake.state.log.length, logCount);
  assert.equal(calls.length, hookCount);
  addAttempt(fake, { id: 'r3b', studentId: 'stu-c2', startedAt: minutesAgo(40), answers: {} });
  await svc.finalizeExpiredAttempt('r3b');
  assert.equal((await svc.finalizeExpiredAttempt('r3b')).outcome, 'expired_no_answers');
});

test('race: if the student submit lands first, the sweep does not overwrite it', async () => {
  const { fake, svc, calls } = setup();
  addAttempt(fake, { id: 'r4', studentId: 'stu-d', startedAt: minutesAgo(40), answers: { q1: 'A' } });
  fake.state.onBeforeFinalizeUpdate = () => {
    const r = fake.state.results.get('r4');
    r.submitted_at = new Date();
    r.status = 'completed';
    r.score = 10;
  };
  const res = await svc.finalizeExpiredAttempt('r4');
  assert.equal(res.finalized, false);
  assert.equal(res.reason, 'race');
  assert.equal(fake.state.results.get('r4').score, 10, 'student submit kept');
  assert.equal(fake.state.log.length, 0);
  assert.equal(calls.length, 0);
});

test('within the grace window nothing is finalized (client submit may still arrive)', async () => {
  const { fake, svc } = setup();
  addAttempt(fake, { id: 'r5', studentId: 'stu-e', startedAt: new Date(Date.now() - 30 * 60000 - 20000), answers: { q1: 'A' } });
  const res = await svc.finalizeExpiredAttempt('r5');
  assert.equal(res.reason, 'not_expired');
  assert.equal(fake.state.results.get('r5').status, 'in_progress');
});

test('empty client auto-submit at expiry (tab open): no-answer attempt becomes expired, not a 0-point result', async () => {
  const { fake, svc } = setup();
  const deadlineIn = (sec) => new Date(Date.now() - 30 * 60000 + sec * 1000);
  addAttempt(fake, { id: 'r9', studentId: 'stu-i1', startedAt: deadlineIn(-5), answers: null });
  const early = await svc.finalizeExpiredAttempt('r9', { now: new Date(Date.now() - 60000), clientDeclared: true });
  assert.equal(early.reason, 'not_expired', 'a minute before the deadline the browser claim is not trusted');
  const res = await svc.finalizeExpiredAttempt('r9', { clientDeclared: true, via: 'client_auto_submit' });
  assert.equal(res.outcome, 'expired_no_answers');
  const r = fake.state.results.get('r9');
  assert.equal(r.status, 'expired');
  assert.equal(r.submitted_at, null);
  assert.equal(r.score, null, 'excluded from averages');

  addAttempt(fake, { id: 'r10', studentId: 'stu-i2', startedAt: deadlineIn(-5), answers: { q1: 'A' } });
  const saved = await svc.finalizeExpiredAttempt('r10', { clientDeclared: true, via: 'client_auto_submit' });
  assert.equal(saved.outcome, 'expired_auto_submitted', 'autosaved answers are submitted even if the final request was empty');
  assert.equal(fake.state.results.get('r10').score, 5);
});

test('late access voids only the empty expired attempt; voided attempts never count', async () => {
  const { fake, svc } = setup();
  addAttempt(fake, { id: 'r6', studentId: 'stu-f', startedAt: minutesAgo(45), answers: {} });
  await svc.finalizeExpiredAttempt('r6');
  const n = await svc.voidExpiredAttemptsForLateAccess({ examId: EXAM.id, studentId: 'stu-f', actorId: 'teacher-1' });
  assert.equal(n, 1);
  assert.equal(fake.state.results.get('r6').status, 'voided');
  const p = fake.state.progress.get('exam-1:stu-f');
  assert.equal(p.status, 'not_started');
  assert.equal(p.expired_at, null);
  assert.ok(fake.state.log.find((l) => l.event_type === 'exam_attempt_voided'));
  const st = examStudentState({ ...p, result_status: 'voided', result_submitted_at: null, score: 99 });
  assert.equal(st.counts_for_average, false);
  assert.equal(st.status, 'not_started');
  assert.equal(await svc.voidExpiredAttemptsForLateAccess({ examId: EXAM.id, studentId: 'stu-f' }), 0, 'idempotent');
});

test('sweep finalizes due attempts and the average excludes no-answer attempts', async () => {
  const { fake, svc } = setup();
  addAttempt(fake, { id: 'ra', studentId: 's1', startedAt: minutesAgo(40), answers: { q1: 'A', q2: 'B' } });
  addAttempt(fake, { id: 'rb', studentId: 's2', startedAt: minutesAgo(40), answers: {} });
  addAttempt(fake, { id: 'rc', studentId: 's3', startedAt: minutesAgo(5), answers: { q1: 'A' } });
  addAttempt(fake, { id: 'rd', studentId: 's4', startedAt: minutesAgo(60 * 24 * 30), answers: { q1: 'A' } });
  const summary = await svc.sweepExpiredAttempts();
  assert.deepEqual(summary, { checked: 2, auto_submitted: 1, no_answers: 1, skipped: 0 });
  assert.equal(fake.state.results.get('rc').status, 'in_progress', 'still running');
  assert.equal(fake.state.results.get('rd').status, 'in_progress', 'month-old stale attempt is left for the backfill report');
  const rows = ['s1', 's2', 's3'].map((sid) => {
    const p = fake.state.progress.get(`exam-1:${sid}`) || { student_id: sid };
    const r = [...fake.state.results.values()].find((x) => x.student_id === sid);
    return { student_id: sid, full_name: sid, ...examStudentState({ ...p, score: r.score, result_status: r.status, result_started_at: r.started_at, result_submitted_at: r.submitted_at }) };
  });
  const card = summarizeExam(rows);
  assert.equal(card.scored_count, 1);
  assert.equal(card.average_score, 10);
  assert.equal(card.expired_no_answers, 1);
  assert.equal(card.auto_submitted, 1);
});

test('autosave stores answers for the own open attempt only, without log noise', async () => {
  const { fake, svc } = setup();
  addAttempt(fake, { id: 'rs', studentId: 'stu-g', startedAt: minutesAgo(5), answers: null });
  const out = await svc.autosaveAttempt({ studentId: 'stu-g', examId: EXAM.id, answers: { q1: 'A', q2: '' } });
  assert.equal(out.saved, true);
  assert.equal(out.answered_count, 1);
  assert.deepEqual(fake.state.results.get('rs').answers, { q1: 'A', q2: '' });
  assert.equal(fake.state.log.length, 0, 'autosave does not write the activity log');
  assert.equal(fake.state.progress.get('exam-1:stu-g').answered_question_count, 1);
  await assert.rejects(
    svc.autosaveAttempt({ studentId: 'someone-else', examId: EXAM.id, answers: { q1: 'B' } }),
    (e) => e.statusCode === 409 && e.code === 'EXAM_NOT_ACTIVE',
  );
  assert.deepEqual(fake.state.results.get('rs').answers, { q1: 'A', q2: '' }, 'other student cannot write');
  await assert.rejects(svc.autosaveAttempt({ studentId: 'stu-g', examId: EXAM.id, answers: [1, 2] }), (e) => e.statusCode === 400);
  await assert.rejects(
    svc.autosaveAttempt({ studentId: 'stu-g', examId: EXAM.id, answers: { q1: 'x'.repeat(210 * 1024) } }),
    (e) => e.statusCode === 413,
  );
  addAttempt(fake, { id: 'rt', studentId: 'stu-h', startedAt: minutesAgo(31), answers: { q1: 'A' } });
  await assert.rejects(svc.autosaveAttempt({ studentId: 'stu-h', examId: EXAM.id, answers: { q1: 'B' } }), (e) => e.code === 'EXAM_NOT_ACTIVE');
  assert.deepEqual(fake.state.results.get('rt').answers, { q1: 'A' }, 'no edits after the deadline');
});

test('viewed/started/submitted with pending grading, then release after teacher confirmation', async () => {
  const { fake, svc, calls } = setup({ pending: true, released: false });
  fake.state.assignments.add('exam-1:stu-i');
  await svc.recordExamViewed({ studentId: 'stu-i', examId: EXAM.id });
  await svc.recordExamViewed({ studentId: 'stu-i', examId: EXAM.id });
  assert.equal(fake.state.log.filter((l) => l.event_type === 'exam_viewed').length, 1, 'viewed is logged once');
  await assert.rejects(svc.recordExamViewed({ studentId: 'not-assigned', examId: EXAM.id }), (e) => e.statusCode === 403);
  addAttempt(fake, { id: 'rp', studentId: 'stu-i', startedAt: new Date() });
  await svc.recordExamStarted({ studentId: 'stu-i', examId: EXAM.id, resultId: 'rp', startedAt: new Date() });
  assert.equal(fake.state.progress.get('exam-1:stu-i').status, 'in_progress');
  assert.equal(fake.state.progress.get('exam-1:stu-i').attempt_count, 1);
  const r = fake.state.results.get('rp');
  Object.assign(r, { submitted_at: new Date(), status: 'completed', score: 5, answers: { q1: 'A' }, grading: {} });
  await svc.recordExamSubmitted({ studentId: 'stu-i', examId: EXAM.id, resultId: 'rp', gradingPending: true, answeredCount: 1 });
  assert.equal(fake.state.progress.get('exam-1:stu-i').status, 'pending_manual_grading');
  assert.equal(calls.filter((c) => c.name === 'result_released').length, 0);

  const svc2 = createAssessmentAttemptService({
    db: fake.db,
    hooks: hookRecorder().hooks,
    gradingPending: () => false,
    resultView: async () => ({ released: true }),
  });
  const out = await svc2.refreshAfterOpenGrading('rp');
  assert.equal(out.status, 'result_released');
  assert.ok(fake.state.progress.get('exam-1:stu-i').result_released_at);
  assert.equal(fake.state.log.filter((l) => l.event_type === 'exam_result_released').length, 1);
  await svc2.refreshAfterOpenGrading('rp');
  assert.equal(fake.state.log.filter((l) => l.event_type === 'exam_result_released').length, 1, 'released once');
});
