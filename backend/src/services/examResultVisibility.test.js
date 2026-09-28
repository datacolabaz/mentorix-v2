const test = require('node:test');
const assert = require('node:assert/strict');
const {
  LEGACY_ANSWERS_WITHOUT_KEY,
  normalizeResultMode,
  effectiveResultMode,
  showResultsForMode,
  resolveStudentResultView,
  applyStudentResultView,
  applyStudentListRowView,
  isResultDelayed,
} = require('./examResultVisibility');

const NOW = new Date('2026-09-28T12:00:00Z');
const PAST = '2026-09-27T12:00:00Z';
const FUTURE = '2026-09-29T12:00:00Z';

const breakdown = [
  { order: 1, is_correct: true, student_answer: 'A', status_label: 'Düzgün', correct_display: 'A' },
  { order: 2, is_correct: false, student_answer: 'B', status_label: 'Səhv', correct_display: 'C' },
  { order: 3, is_correct: null, student_answer: '—', status_label: 'Cavabsız', correct_display: 'D' },
  { order: 4, is_correct: null, student_answer: 'text', status_label: 'Qismən düzgün', correct_display: '' },
];

const payload = () => ({
  score: 7.5,
  score_display: 7.5,
  grading_pending: false,
  breakdown: breakdown.map((r) => ({ ...r })),
  type_summary: { by_type: {}, score: 7.5 },
  answers: { 1: 'A' },
  certificate: { id: 'c1' },
  certificate_meta: { eligible: true },
});

test('normalizeResultMode accepts only the five modes', () => {
  assert.equal(normalizeResultMode(' Score_Only '), 'score_only');
  assert.equal(normalizeResultMode('legacy_answers_without_key'), null);
  assert.equal(normalizeResultMode(''), null);
  assert.equal(normalizeResultMode(null), null);
});

test('legacy exams keep their previous behaviour', () => {
  assert.equal(effectiveResultMode({ show_results: true, result_visibility_mode: null }), 'immediate_full_review');
  assert.equal(effectiveResultMode({ show_results: null, result_visibility_mode: null }), 'immediate_full_review');
  assert.equal(effectiveResultMode({ show_results: false, result_visibility_mode: null }), LEGACY_ANSWERS_WITHOUT_KEY);

  const legacyHidden = resolveStudentResultView({ show_results: false }, { now: NOW });
  assert.equal(legacyHidden.released, true);
  assert.equal(legacyHidden.show_score, true);
  assert.equal(legacyHidden.show_breakdown, true);
  assert.equal(legacyHidden.show_correct_answers, false);

  const out = applyStudentResultView(payload(), legacyHidden);
  assert.equal(out.score, 7.5);
  assert.equal(out.breakdown.length, 4);
  assert.deepEqual(out.answers, { 1: 'A' });
  assert.deepEqual(out.certificate, { id: 'c1' });
});

test('feature flag OFF falls back to show_results even when a mode is stored', () => {
  const exam = { show_results: true, result_visibility_mode: 'score_only' };
  assert.equal(effectiveResultMode(exam, { modesEnabled: false }), 'immediate_full_review');
  assert.equal(effectiveResultMode(exam, { modesEnabled: true }), 'score_only');
});

test('immediate_full_review: score, answers and correct answers', () => {
  const view = resolveStudentResultView({ result_visibility_mode: 'immediate_full_review' }, { now: NOW });
  assert.equal(view.show_correct_answers, true);
  const out = applyStudentResultView(payload(), view);
  assert.equal(out.score, 7.5);
  assert.equal(out.breakdown.length, 4);
  assert.equal(out.result_visibility.mode, 'immediate_full_review');
});

test('after_exam_window: hidden before release, full review after', () => {
  const exam = { result_visibility_mode: 'after_exam_window', available_until: FUTURE };
  const before = resolveStudentResultView(exam, { now: NOW });
  assert.equal(before.released, false);
  assert.equal(before.reason, 'exam_window');
  assert.equal(before.release_at, new Date(FUTURE).toISOString());
  assert.equal(isResultDelayed(before), true);

  const hidden = applyStudentResultView(payload(), before);
  assert.equal(hidden.score, null);
  assert.equal(hidden.score_display, 'hidden');
  assert.deepEqual(hidden.breakdown, []);
  assert.equal(hidden.type_summary, null);
  assert.equal('answers' in hidden, false);
  assert.equal(hidden.certificate, null);

  const after = resolveStudentResultView({ ...exam, available_until: PAST }, { now: NOW });
  assert.equal(after.released, true);
  assert.equal(after.show_correct_answers, true);
});

test('after_exam_window: explicit release date wins over available_until', () => {
  const exam = { result_visibility_mode: 'after_exam_window', available_until: PAST, results_release_at: FUTURE };
  assert.equal(resolveStudentResultView(exam, { now: NOW }).released, false);
});

test('after_manual_grading: hidden while grading is pending', () => {
  const exam = { result_visibility_mode: 'after_manual_grading' };
  const pending = resolveStudentResultView(exam, { gradingPending: true, now: NOW });
  assert.equal(pending.released, false);
  assert.equal(pending.reason, 'manual_grading');
  const done = resolveStudentResultView(exam, { gradingPending: false, now: NOW });
  assert.equal(done.released, true);
  assert.equal(done.show_correct_answers, true);
});

test('score_only: score and summary, no per-question details', () => {
  const view = resolveStudentResultView({ result_visibility_mode: 'score_only' }, { now: NOW });
  const out = applyStudentResultView(payload(), view);
  assert.equal(out.score, 7.5);
  assert.ok(out.type_summary);
  assert.deepEqual(out.breakdown, []);
  assert.equal('answers' in out, false);
  assert.equal(view.show_correct_answers, false);
  assert.equal(showResultsForMode('score_only'), false);
});

test('wrong_answers_only: only wrong, unanswered and partial rows', () => {
  const view = resolveStudentResultView({ result_visibility_mode: 'wrong_answers_only' }, { now: NOW });
  const out = applyStudentResultView(payload(), view);
  assert.deepEqual(
    out.breakdown.map((r) => r.order),
    [2, 3, 4],
  );
  assert.equal(view.show_correct_answers, true);
  assert.equal(out.score, 7.5);
});

test('student list hides score and rank until release', () => {
  const row = { id: 'e1', score: 9, rank_in_group: 1, submitted_at: PAST };
  const hidden = applyStudentListRowView(
    row,
    resolveStudentResultView({ result_visibility_mode: 'after_exam_window', available_until: FUTURE }, { now: NOW }),
  );
  assert.equal(hidden.score, null);
  assert.equal(hidden.rank_in_group, null);
  assert.equal(hidden.result_visibility.released, false);

  const shown = applyStudentListRowView(row, resolveStudentResultView({ show_results: false }, { now: NOW }));
  assert.equal(shown.score, 9);
  assert.equal(shown.rank_in_group, 1);
});
