const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseArgs,
  maskedDbHost,
  planMaterialProgress,
  planAssignmentProgress,
  planExamProgress,
} = require('./backfill-activity-progress');

test('dry-run is the default; --apply must be explicit; bad args are rejected', () => {
  assert.equal(parseArgs([]).apply, false);
  assert.equal(parseArgs(['--dry-run']).apply, false);
  assert.equal(parseArgs(['--apply']).apply, true);
  const o = parseArgs(['--only=exams,materials', '--batch=200', '--instructor=11111111-1111-4111-8111-111111111111']);
  assert.deepEqual([...o.only].sort(), ['exams', 'materials']);
  assert.equal(o.batch, 200);
  assert.equal(o.errors.length, 0);
  assert.ok(parseArgs(['--only=users']).errors.length);
  assert.ok(parseArgs(['--batch=10']).errors.length);
  assert.ok(parseArgs(['--instructor=abc']).errors.length);
  assert.ok(parseArgs(['--force']).errors.length);
});

test('db host is masked and credentials never printed', () => {
  const out = maskedDbHost('postgres://user:secret@containers-us-west-123.railway.app:6543/railway');
  assert.equal(out.includes('secret'), false);
  assert.equal(out.includes('user'), false);
  assert.match(out, /6543\/railway$/);
});

test('material plan: view count from events, idempotent, downloads never make a view', () => {
  const row = {
    file_type: 'application/pdf', file_url: '/api/materials/file/a.pdf',
    first_viewed_at: '2026-09-01T10:00:00Z', view_count: 0,
    views: 3, opens: 5, last_view_at: '2026-09-10T10:00:00Z',
    download_count: 2, downloads: 2, first_download_at: '2026-09-02T10:00:00Z', last_download_at: '2026-09-05T10:00:00Z',
  };
  const p = planMaterialProgress(row);
  assert.equal(p.changed, true);
  assert.equal(p.values.view_count, 3);
  assert.equal(p.values.last_viewed_at.toISOString(), '2026-09-10T10:00:00.000Z');
  assert.equal(p.values.first_downloaded_at.toISOString(), '2026-09-02T10:00:00.000Z');
  const again = planMaterialProgress({ ...row, ...p.values });
  assert.equal(again.changed, false, 'second run changes nothing');
  const onlyDownloaded = planMaterialProgress({ ...row, views: 0, opens: 0, view_count: 0 });
  assert.equal(onlyDownloaded.viewedOnlyViaDownload, true, 'reported for the D18 decision, not changed');
  const link = planMaterialProgress({ file_type: '', file_url: 'https://youtube.com/x', first_viewed_at: '2026-09-01T10:00:00Z', views: 0, opens: 4, view_count: 0 });
  assert.equal(link.values.view_count, 4);
  const noDownloads = planMaterialProgress({ ...row, download_count: 0, first_download_at: '2026-09-02T10:00:00Z' });
  assert.equal(noDownloads.values.first_downloaded_at, null);
});

test('assignment plan matches the live status rules', () => {
  const now = new Date('2026-10-01T10:00:00Z');
  assert.equal(planAssignmentProgress({ status: 'reviewed', submitted_at: '2026-09-20T10:00:00Z', reviewed_at: '2026-09-21T10:00:00Z' }, now).status, 'graded');
  const late = planAssignmentProgress({ status: 'late', submitted_at: '2026-09-25T10:00:00Z', due_date: '2026-09-20' }, now);
  assert.equal(late.status, 'late_submitted');
  assert.equal(late.is_late, true);
  assert.equal(late.submission_count, 1);
  assert.ok(late.overdue_at);
  assert.equal(planAssignmentProgress({ status: 'pending', seen_at: '2026-09-25T10:00:00Z' }, now).status, 'viewed');
  assert.equal(planAssignmentProgress({ status: 'pending', due_date: '2026-09-20' }, now).status, 'overdue');
  assert.equal(planAssignmentProgress({ status: 'pending', st_started_at: '2026-09-25T10:00:00Z' }, now).status, 'in_progress');
});

test('exam plan: pending grading, released, expired, voided', () => {
  const exam = { id: 'e', duration_minutes: 30, result_visibility_mode: 'after_exam_window', available_until: '2026-09-30T00:00:00Z' };
  const base = { result_id: 'r', result_status: 'completed', result_started_at: '2026-09-29T10:00:00Z', result_submitted_at: '2026-09-29T10:20:00Z', answers: { q: 'A' }, grading: {}, attempt_count: 1 };
  const deps = (pending, released) => ({ gradingPending: () => pending, resolveView: () => ({ released }) });
  assert.equal(planExamProgress({ row: base, exam, questions: [{}], deps: deps(true, true) }).status, 'pending_manual_grading');
  const rel = planExamProgress({ row: base, exam, questions: [{}], deps: deps(false, true) });
  assert.equal(rel.status, 'result_released');
  assert.equal(new Date(rel.result_released_at).toISOString(), '2026-09-30T00:00:00.000Z', 'released when the window closed');
  assert.equal(planExamProgress({ row: base, exam, questions: [{}], deps: deps(false, false) }).status, 'completed');
  assert.equal(
    planExamProgress({ row: { ...base, result_status: 'expired', result_submitted_at: null, answers: {} }, exam, questions: [], deps: deps(false, true) }).status,
    'expired_no_answers',
  );
  assert.equal(planExamProgress({ row: { ...base, result_status: 'voided' }, exam, questions: [], deps: deps(false, true) }).status, 'not_started');
  assert.equal(planExamProgress({ row: { attempt_count: 0 }, exam, questions: [], deps: deps(false, true) }).status, 'not_started');
});
