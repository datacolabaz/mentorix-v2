const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const R = require('./questionBankRules');
const { sampleQuestion } = require('./questionBankTestFixtures');
const { resolveStudentResultView } = require('./examResultVisibility');
const subject = randomUUID();
const invalid = fn => assert.throws(fn, e => e.statusCode === 400);

for (const type of R.TYPES) {
  test(`${type}: published contract, normalized response and deterministic grading`, () => {
    const { q, answer } = sampleQuestion(type, subject);
    const normalized = R.normalizeQuestion(q);
    const value = R.normalizeAnswer(normalized, answer);
    const grade = R.gradeAnswer(normalized, value);
    assert.equal(grade.status, R.MANUAL.has(type) ? 'pending_review' : 'auto_graded');
    assert.equal(grade.awarded_points, R.MANUAL.has(type) ? null : 2);
    const dto = R.publicQuestion({ ...normalized, id: randomUUID() });
    assert.equal(dto.options.length, q.options.length);
    const json = JSON.stringify(dto);
    for (const key of ['answer_key', 'is_correct', 'explanation', 'source_pdf_id', 'source_page', 'PRIVATE_ACCEPTED', 'PRIVATE_EXPLANATION']) {
      assert.equal(json.includes(key), false, key);
    }
  });
}
test('all automatic types give zero for an unanswered question; manual never auto grades even a blank', () => {
  for (const type of R.TYPES) {
    const q = R.normalizeQuestion(sampleQuestion(type, subject).q);
    const grade = R.gradeAnswer(q, null);
    assert.equal(grade.awarded_points, R.MANUAL.has(type) ? null : 0);
  }
});
test('single choice requires exactly one correct flag if no explicit key', () => {
  const { q } = sampleQuestion('single_choice', subject);
  q.answer_key = {};
  invalid(() => R.normalizeQuestion(q));
  q.options[0].is_correct = true;
  assert.equal(R.normalizeQuestion(q).answer_key.option_id, q.options[0].id);
  q.options[1].is_correct = true;
  invalid(() => R.normalizeQuestion(q));
});
test('keys cannot refer to foreign options or incomplete/duplicate matching and ordering', () => {
  for (const type of ['single_choice', 'multiple_choice', 'matching', 'ordering']) {
    const { q } = sampleQuestion(type, subject);
    if (type === 'single_choice') q.answer_key.option_id = randomUUID();
    if (type === 'multiple_choice') q.answer_key.option_ids.push(randomUUID());
    if (type === 'matching') q.answer_key.pairs[Object.keys(q.answer_key.pairs)[0]] = randomUUID();
    if (type === 'ordering') q.answer_key.order = [q.options[0].id, q.options[0].id];
    invalid(() => R.normalizeQuestion(q));
  }
});
test('manual questions reject any model/automatic grading key', () => {
  for (const type of ['open_answer', 'file_upload']) {
    const { q } = sampleQuestion(type, subject);
    q.answer_key = { model_answer: 'not supported' };
    invalid(() => R.normalizeQuestion(q));
  }
});
test('drafts may omit keys; publishing incomplete drafts is rejected', () => {
  for (const type of R.TYPES.filter(t => !R.MANUAL.has(t))) {
    const { q } = sampleQuestion(type, subject);
    q.status = 'draft'; q.answer_key = {};
    assert.deepEqual(R.normalizeQuestion(q).answer_key, {});
    q.status = 'published';
    invalid(() => R.normalizeQuestion(q));
  }
});
test('short answers are exact accepted answers after NFKC/case/whitespace normalization, not substrings', () => {
  const { q } = sampleQuestion('short_answer', subject);
  const normalized = R.normalizeQuestion(q);
  assert.equal(R.gradeAnswer(normalized, 'PRIVATE_ACCEPTED extra').is_correct, false);
  assert.equal(R.gradeAnswer(normalized, ' private_accepted ').is_correct, true);
  normalized.answer_key.case_sensitive = true;
  assert.equal(R.gradeAnswer(normalized, 'private_accepted').is_correct, false);
});
test('numeric zero, tolerance boundaries, accepted alternatives and strict finite parsing', () => {
  const q = R.normalizeQuestion(sampleQuestion('numeric', subject).q);
  assert.equal(R.gradeAnswer(q, 0).is_correct, true);
  assert.equal(R.gradeAnswer(q, 2.51).is_correct, true);
  assert.equal(R.gradeAnswer(q, 2.511).is_correct, false);
  for (const v of [false, {}, [], ' ', '2abc', '0x10', Infinity, NaN, 'Infinity']) invalid(() => R.normalizeAnswer(q, v));
  q.answer_key.tolerance = 0;
  assert.equal(R.gradeAnswer(q, 2.5).is_correct, true);
});
test('multiple choice is set equality, ordering is sequence equality, matching is full one-to-one', () => {
  for (const type of ['multiple_choice', 'ordering', 'matching']) {
    const { q: input, answer } = sampleQuestion(type, subject);
    const q = R.normalizeQuestion(input);
    const partial = type === 'matching' ? Object.fromEntries(Object.entries(answer).slice(0, 1)) : answer.slice(0, 1);
    assert.equal(R.gradeAnswer(q, R.normalizeAnswer(q, partial)).is_correct, false);
    if (Array.isArray(answer)) invalid(() => R.normalizeAnswer(q, [answer[0], answer[0]]));
  }
});
test('file answers can only reference the server-owned file set', () => {
  const q = R.normalizeQuestion(sampleQuestion('file_upload', subject).q);
  const f = randomUUID();
  assert.deepEqual(R.normalizeAnswer(q, { file_ids: [f] }, [f]), { file_ids: [f] });
  invalid(() => R.normalizeAnswer(q, { file_ids: [randomUUID()] }, [f]));
  invalid(() => R.normalizeAnswer(q, { file_ids: [] }, [f]));
});
test('fixed maximums, strict UUIDs, score precision and JSON bounds', () => {
  for (const value of [-1, 0, 0.001, 1.999, 'NaN', Infinity, true, 1000000]) invalid(() => R.cents(value));
  assert.equal(R.cents(0, 'score', { zero: true }), 0);
  assert.equal(R.cents('2.50'), 250);
  invalid(() => R.id('not-a-uuid'));
  invalid(() => R.page({ limit: 101 }));
  invalid(() => R.page({ offset: -1 }));
  invalid(() => R.jsonLimit({ x: 'a'.repeat(R.MAX_ANSWERS_BYTES) }));
  invalid(() => R.date('2026-10-16T12:00:00', 'date'));
});
test('shuffle copies and preserves every item; order is reusable rather than reshuffled on GET', () => {
  const input = Array.from({ length: 20 }, (_, i) => i);
  const out = R.shuffled(input);
  assert.notEqual(input, out);
  assert.deepEqual(input, Array.from({ length: 20 }, (_, i) => i));
  assert.deepEqual([...out].sort((a, b) => a - b), input);
});
test('deadline is personal duration, or capped at the assignment/global end when configured', () => {
  const exam = { duration_minutes: 60, available_until: '2026-10-16T12:30:00Z' };
  const a = { started_at: '2026-10-16T12:00:00Z' };
  assert.equal(R.deadline(exam, a).toISOString(), '2026-10-16T13:00:00.000Z');
  exam.allow_finish_after_until = false;
  assert.equal(R.deadline(exam, a).toISOString(), '2026-10-16T12:30:00.000Z');
  assert.equal(R.deadline(exam, a, { late_access_until: '2026-10-16T12:45:00Z' }).toISOString(), '2026-10-16T12:45:00.000Z');
});
test('existing release policies cover manual, delayed, score-only, wrong-only and full review', () => {
  for (const mode of ['after_exam_window', 'after_manual_grading']) {
    const view = resolveStudentResultView({ result_visibility_mode: mode, available_until: '2100-01-01T00:00:00Z' }, { gradingPending: true });
    assert.equal(view.show_score, false);
    assert.equal(view.show_breakdown, false);
  }
  assert.equal(resolveStudentResultView({ result_visibility_mode: 'score_only' }).show_breakdown, false);
  assert.equal(resolveStudentResultView({ result_visibility_mode: 'wrong_answers_only' }).only_wrong, true);
  assert.equal(resolveStudentResultView({
    result_visibility_mode: 'after_manual_grading', question_bank_enabled: true,
  }, { modesEnabled: false, gradingPending: true }).show_score, false);
});
