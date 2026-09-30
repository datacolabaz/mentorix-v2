const test = require('node:test');
const assert = require('node:assert/strict');

const OWNER = 'teacher-1';
const NOW = new Date('2026-10-01T10:00:00Z');

const EXAMS = [{ id: 'exam-1', instructor_id: OWNER, title: 'Final', question_count: 2, max_points: '10', created_at: NOW }];
const ROSTER = [
  { exam_id: 'exam-1', student_id: 'a', full_name: 'Aysel', status: 'result_released', started_at: '2026-10-01T09:00:00Z', completed_at: '2026-10-01T09:20:00Z', result_released_at: '2026-10-01T09:20:00Z', result_id: 'r-a', result_status: 'completed', result_submitted_at: '2026-10-01T09:20:00Z', score: '8' },
  { exam_id: 'exam-1', student_id: 'b', full_name: 'Babək', status: 'expired_auto_submitted', started_at: '2026-10-01T08:00:00Z', completed_at: '2026-10-01T08:30:00Z', expired_at: '2026-10-01T08:30:00Z', result_id: 'r-b', result_status: 'completed', result_submitted_at: '2026-10-01T08:30:00Z', score: '4' },
  { exam_id: 'exam-1', student_id: 'c', full_name: 'Cavid', status: 'expired_no_answers', started_at: '2026-10-01T08:00:00Z', expired_at: '2026-10-01T08:30:00Z', result_id: 'r-c', result_status: 'expired', score: null },
  { exam_id: 'exam-1', student_id: 'd', full_name: 'Dilarə', status: 'in_progress', started_at: '2026-10-01T09:55:00Z', latest_activity_at: '2026-10-01T09:58:00Z', result_id: 'r-d', result_status: 'in_progress' },
  { exam_id: 'exam-1', student_id: 'e', full_name: 'Elvin' },
  // Aqreqat sətri hələ yoxdur (backfill-dən əvvəl): cəhddən ehtiyat hesablanır
  { exam_id: 'exam-1', student_id: 'f', full_name: 'Fidan', result_id: 'r-f', result_status: 'completed', result_started_at: '2026-10-01T07:00:00Z', result_submitted_at: '2026-10-01T07:30:00Z', score: '6' },
];

const queries = [];
const dbId = require.resolve('../utils/db');
require.cache[dbId] = {
  id: dbId,
  filename: dbId,
  loaded: true,
  exports: {
    query: async (sql, params) => {
      queries.push({ sql, params });
      const owner = params[0];
      if (/FROM exams e\s+WHERE e.instructor_id = \$1/.test(sql) && !/WITH ex AS/.test(sql)) {
        return { rows: EXAMS.filter((e) => e.instructor_id === owner && (!params[1] || params[1].includes(e.id))) };
      }
      if (/WITH ex AS/.test(sql)) {
        const allowed = EXAMS.filter((e) => e.instructor_id === owner).map((e) => e.id);
        return { rows: ROSTER.filter((r) => allowed.includes(r.exam_id) && params[1].includes(r.exam_id)) };
      }
      throw new Error('unexpected SQL');
    },
    transaction: async () => {
      throw new Error('no writes expected');
    },
  },
};

const { getExamSummaries, getExamDetail, EXAM_ROSTER_SQL } = require('./engagementService');

test('exam dashboard card equals the detail header and matches the detail rows', async () => {
  const [card] = await getExamSummaries(OWNER, { now: NOW });
  const detail = await getExamDetail(OWNER, 'exam-1', { now: NOW });
  assert.deepEqual(card, detail.exam);
  const rows = detail.students;
  assert.equal(card.assigned, rows.length);
  assert.equal(card.completed, rows.filter((s) => s.completed).length);
  assert.equal(card.expired_no_answers, rows.filter((s) => s.status === 'expired_no_answers').length);
  assert.equal(card.in_progress, rows.filter((s) => s.status === 'in_progress').length);
  assert.equal(card.not_started, rows.filter((s) => s.status === 'not_started').length);
  const scored = rows.filter((s) => s.counts_for_average);
  assert.equal(card.scored_count, scored.length);
  assert.equal(card.average_score, scored.reduce((a, s) => a + s.score, 0) / scored.length);
  assert.equal(card.average_score, 6, '(8 + 4 + 6) / 3 — no-answer attempt excluded');
  assert.equal(card.average_pct, 60);
  const filtered = await getExamDetail(OWNER, 'exam-1', { filter: 'expired', now: NOW });
  assert.equal(filtered.students.length, card.expired);
});

test('another teacher gets nothing: summaries empty, detail 404', async () => {
  assert.deepEqual(await getExamSummaries('teacher-2', { now: NOW }), []);
  await assert.rejects(getExamDetail('teacher-2', 'exam-1', { now: NOW }), (e) => e.statusCode === 404);
  assert.match(EXAM_ROSTER_SQL, /e\.instructor_id = \$1/, 'roster is always scoped by the owner id');
  assert.match(EXAM_ROSTER_SQL, /<> 'voided'/, 'voided attempts never appear');
});
