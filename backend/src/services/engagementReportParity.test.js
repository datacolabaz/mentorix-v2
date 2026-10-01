const test = require('node:test');
const assert = require('node:assert/strict');

/**
 * Kart rəqəmləri = ətraflı hesabatın sətir sayı (spec: «Dashboard counts must equal detailed report rows»).
 * Hər üç növ üçün CARD_FILTER_PARITY-dəki hər sahə yoxlanılır: kart (siyahı endpoint-i) və hesabat (filtrlə,
 * səhifələnmiş) eyni servis funksiyalarından gəlir. DB yoxdur: sorğular saxta cavablarla əvəzlənir.
 */

const OWNER = 'teacher-1';
const OTHER = 'teacher-2';
const NOW = new Date('2026-10-01T10:00:00Z');
const G1 = '11111111-1111-4111-8111-111111111111';
const G2 = '22222222-2222-4222-8222-222222222222';

const MATERIALS = [
  { id: 'm1', instructor_id: OWNER, title: 'Kəsrlər — İzah PDF', file_type: 'application/pdf', file_url: '/api/materials/file/k.pdf', due_at: '2026-09-30T10:00:00Z', created_at: NOW, uploader_id: OWNER, uploader_name: 'Müəllim', group_names: ['7A'] },
];
const MATERIAL_ROSTER = [
  { material_id: 'm1', student_id: 's1', full_name: 'Aysel', group_name: '7A', first_opened_at: '2026-09-29T08:00:00Z', first_viewed_at: '2026-09-29T08:01:00Z', completed_at: '2026-09-29T08:01:00Z', last_activity_at: '2026-09-30T08:00:00Z', view_count: 3, download_count: 2, first_downloaded_at: '2026-09-29T09:00:00Z', last_downloaded_at: '2026-09-30T08:00:00Z' },
  { material_id: 'm1', student_id: 's2', full_name: 'Babək', group_name: '7A', download_count: 1, first_downloaded_at: '2026-09-29T09:00:00Z', last_downloaded_at: '2026-09-29T09:00:00Z', last_activity_at: '2026-09-29T09:00:00Z' },
  { material_id: 'm1', student_id: 's3', full_name: 'Cavid', group_name: '7A', first_opened_at: '2026-09-29T10:00:00Z', last_activity_at: '2026-09-29T10:00:00Z' },
  { material_id: 'm1', student_id: 's4', full_name: 'Dilarə', group_name: '7B' },
  { material_id: 'm1', student_id: 's5', full_name: 'Elvin', group_name: '7B', first_opened_at: '2026-09-28T10:00:00Z', first_viewed_at: '2026-09-28T10:01:00Z', last_activity_at: '2026-09-28T10:01:00Z', view_count: 1 },
];

const ASSIGNMENTS = [
  { id: 'a1', instructor_id: OWNER, title: 'Faiz məsələləri', due_date: '2026-10-05', max_score: 10, created_at: NOW, group_name: '7A' },
  { id: 'a2', instructor_id: OWNER, title: 'Köhnə tapşırıq', due_date: '2026-09-25', max_score: 10, created_at: NOW, group_name: '7B' },
];
const ASSIGNMENT_ROWS = [
  { student_assignment_id: 'sa1', assignment_id: 'a1', student_id: 's1', full_name: 'Aysel', status: 'reviewed', submitted_at: '2026-09-29T10:00:00Z', reviewed_at: '2026-09-30T10:00:00Z', score: 9, submission_count: 1, first_opened_at: '2026-09-28T10:00:00Z', started_at: '2026-09-28T10:05:00Z' },
  { student_assignment_id: 'sa2', assignment_id: 'a1', student_id: 's2', full_name: 'Babək', status: 'submitted', submitted_at: '2026-09-30T10:00:00Z', submission_count: 1 },
  { student_assignment_id: 'sa3', assignment_id: 'a1', student_id: 's3', full_name: 'Cavid', status: 'returned', returned_at: '2026-09-30T11:00:00Z', first_submitted_at: '2026-09-29T11:00:00Z', submission_count: 1 },
  { student_assignment_id: 'sa4', assignment_id: 'a1', student_id: 's4', full_name: 'Dilarə', status: 'pending', first_opened_at: '2026-09-30T09:00:00Z', started_at: '2026-09-30T09:10:00Z', last_activity_at: '2026-09-30T09:20:00Z' },
  { student_assignment_id: 'sa5', assignment_id: 'a1', student_id: 's5', full_name: 'Elvin', status: 'pending', first_opened_at: '2026-09-30T09:00:00Z' },
  { student_assignment_id: 'sa6', assignment_id: 'a1', student_id: 's6', full_name: 'Fidan', status: 'pending' },
  { student_assignment_id: 'sa7', assignment_id: 'a2', student_id: 's1', full_name: 'Aysel', status: 'late', submitted_at: '2026-09-27T10:00:00Z', submission_count: 1 },
  { student_assignment_id: 'sa8', assignment_id: 'a2', student_id: 's2', full_name: 'Babək', status: 'pending', first_opened_at: '2026-09-24T09:00:00Z' },
  { student_assignment_id: 'sa9', assignment_id: 'a2', student_id: 's3', full_name: 'Cavid', status: 'pending' },
];

const EXAMS = [{ id: 'e1', instructor_id: OWNER, title: 'Riyaziyyat KSQ 1', question_count: 2, max_points: '10', created_at: NOW, available_until: '2026-10-02T10:00:00Z' }];
const EXAM_ROSTER = [
  { exam_id: 'e1', student_id: 's1', full_name: 'Aysel', status: 'result_released', started_at: '2026-10-01T09:00:00Z', completed_at: '2026-10-01T09:20:00Z', result_released_at: '2026-10-01T09:20:00Z', result_status: 'completed', result_submitted_at: '2026-10-01T09:20:00Z', score: '8' },
  { exam_id: 'e1', student_id: 's2', full_name: 'Babək', status: 'expired_auto_submitted', started_at: '2026-10-01T08:00:00Z', completed_at: '2026-10-01T08:30:00Z', expired_at: '2026-10-01T08:30:00Z', result_status: 'completed', result_submitted_at: '2026-10-01T08:30:00Z', score: '4' },
  { exam_id: 'e1', student_id: 's3', full_name: 'Cavid', status: 'expired_no_answers', started_at: '2026-10-01T08:00:00Z', expired_at: '2026-10-01T08:30:00Z', result_status: 'expired' },
  { exam_id: 'e1', student_id: 's4', full_name: 'Dilarə', status: 'in_progress', started_at: '2026-10-01T09:55:00Z', latest_activity_at: '2026-10-01T09:58:00Z', result_status: 'in_progress' },
  { exam_id: 'e1', student_id: 's5', full_name: 'Elvin', status: 'in_progress', started_at: '2026-10-01T09:00:00Z', latest_activity_at: '2026-10-01T09:30:00Z', result_status: 'in_progress' },
  { exam_id: 'e1', student_id: 's6', full_name: 'Fidan', status: 'viewed', viewed_at: '2026-10-01T07:00:00Z' },
  { exam_id: 'e1', student_id: 's7', full_name: 'Gülnar' },
  { exam_id: 'e1', student_id: 's8', full_name: 'Həsən', status: 'pending_manual_grading', started_at: '2026-10-01T07:00:00Z', completed_at: '2026-10-01T07:30:00Z', result_status: 'completed', result_submitted_at: '2026-10-01T07:30:00Z', score: '5' },
];

const STUDENT_GROUPS = [
  { student_id: 's1', id: G1, name: '7A' },
  { student_id: 's2', id: G1, name: '7A' },
  { student_id: 's4', id: G2, name: '7B' },
  { student_id: 's5', id: G2, name: '7B' },
];
const LOG_STATS = [{ student_id: 's1', first_activity_at: new Date('2026-09-20T10:00:00Z'), activity_count: 5 }];

const queries = [];
const ownedIds = (list, owner, ids) => list.filter((x) => x.instructor_id === owner && (!ids || ids.includes(x.id)));
const dbId = require.resolve('../utils/db');
require.cache[dbId] = {
  id: dbId,
  filename: dbId,
  loaded: true,
  exports: {
    query: async (sql, params) => {
      queries.push(sql);
      if (/report_student_groups/.test(sql)) return { rows: STUDENT_GROUPS.filter((g) => params[1].includes(g.student_id)) };
      if (/report_log_stats/.test(sql)) return { rows: LOG_STATS };
      if (/exam_group_names/.test(sql)) return { rows: [{ exam_id: 'e1', group_names: ['7A', '7B'] }] };
      if (/WITH mats AS/.test(sql)) {
        const allowed = ownedIds(MATERIALS, params[0], params[1]).map((m) => m.id);
        return { rows: MATERIAL_ROSTER.filter((r) => allowed.includes(r.material_id)) };
      }
      if (/FROM course_materials cm/.test(sql)) return { rows: ownedIds(MATERIALS, params[0], params[1]) };
      if (/FROM assignments a/.test(sql)) return { rows: ownedIds(ASSIGNMENTS, params[0], params[1]) };
      if (/FROM student_assignments sa/.test(sql)) return { rows: ASSIGNMENT_ROWS.filter((r) => params[0].includes(r.assignment_id)) };
      if (/WITH ex AS/.test(sql)) {
        const allowed = ownedIds(EXAMS, params[0], params[1]).map((e) => e.id);
        return { rows: EXAM_ROSTER.filter((r) => allowed.includes(r.exam_id)) };
      }
      if (/FROM exams e/.test(sql)) return { rows: ownedIds(EXAMS, params[0], params[1]) };
      throw new Error(`unexpected SQL: ${sql.slice(0, 80)}`);
    },
    transaction: async () => {
      throw new Error('no writes expected');
    },
  },
};

const svc = require('./engagementService');
const { parseReportQuery, CARD_FILTER_PARITY } = require('./activityReportRules');

const TYPES = {
  material: { list: svc.getMaterialSummaries, detail: svc.getMaterialDetail, key: 'material' },
  assignment: { list: svc.getAssignmentSummaries, detail: svc.getAssignmentDetail, key: 'assignment' },
  exam: { list: svc.getExamSummaries, detail: svc.getExamDetail, key: 'exam' },
};

for (const [type, { list, detail, key }] of Object.entries(TYPES)) {
  test(`${type}: every card count equals the filtered report total (and the paged rows add up)`, async () => {
    const cards = await list(OWNER, { now: NOW });
    assert.ok(cards.length > 0);
    for (const card of cards) {
      for (const [field, filter] of Object.entries(CARD_FILTER_PARITY[type])) {
        const query = parseReportQuery({ ...(filter ? { filter } : {}), page: '1', page_size: '2' }, type);
        const report = await detail(OWNER, card.id, { query, enrich: true, now: NOW });
        assert.deepEqual(report[key], card, 'report header is the same card object');
        assert.equal(report.pagination.total, card[field], `${type} ${card.id}: card.${field} = rows(${filter || 'all'})`);
        let seen = report.students.length;
        for (let p = 2; p <= report.pagination.total_pages; p += 1) {
          const next = await detail(OWNER, card.id, { query: parseReportQuery({ ...(filter ? { filter } : {}), page: String(p), page_size: '2' }, type), enrich: true, now: NOW });
          seen += next.students.length;
        }
        assert.equal(seen, card[field], `${type} ${card.id}: paging through ${filter || 'all'} yields ${card[field]} rows`);
      }
    }
  });
}

test('material card keeps uploader and student downloads apart', async () => {
  const [card] = await svc.getMaterialSummaries(OWNER, { now: NOW });
  assert.deepEqual(card.uploaded_by, { id: OWNER, full_name: 'Müəllim' });
  assert.equal(card.viewed, 2, 'Babək only downloaded: not a viewer');
  assert.equal(card.unique_downloaders, 2);
  assert.equal(card.total_downloads, 3);
  assert.equal(card.total_views, 4);
  assert.deepEqual(card.recent_viewers.map((v) => v.student_id), ['s1', 's5']);
});

test('exam card: average excludes no-answer and ungraded attempts, inactivity after 10 minutes', async () => {
  const [card] = await svc.getExamSummaries(OWNER, { now: NOW });
  assert.equal(card.average_score, 6, '(8 + 4) / 2 — no-answer and pending manual grading excluded');
  assert.equal(card.average_pct, 60);
  assert.equal(card.in_progress, 1, 'Dilarə active 2 minutes ago');
  assert.equal(card.inactive, 1, 'Elvin silent for 30 minutes');
  assert.deepEqual(card.group_names, ['7A', '7B']);
});

test('report rows carry groups, first activity and activity count; group filter uses them', async () => {
  const d = await svc.getExamDetail(OWNER, 'e1', { query: parseReportQuery({ group: G2 }, 'exam'), enrich: true, now: NOW });
  assert.deepEqual(d.students.map((s) => s.student_id).sort(), ['s4', 's5']);
  assert.deepEqual(d.available_groups.map((g) => g.name), ['7A', '7B']);
  const all = await svc.getExamDetail(OWNER, 'e1', { query: parseReportQuery({}, 'exam'), enrich: true, now: NOW });
  const aysel = all.students.find((s) => s.student_id === 's1');
  assert.equal(aysel.first_activity_at, '2026-09-20T10:00:00.000Z', 'earliest of log and progress row');
  assert.equal(aysel.activity_count, 5);
  assert.equal(all.students.find((s) => s.student_id === 's6').first_activity_at, '2026-10-01T07:00:00.000Z');
});

test('another workspace: empty card list, 404 detail, 404 timeline', async () => {
  for (const { list, detail } of Object.values(TYPES)) {
    assert.deepEqual(await list(OTHER, { now: NOW }), []);
  }
  await assert.rejects(svc.getMaterialDetail(OTHER, 'm1', { now: NOW }), (e) => e.statusCode === 404);
  await assert.rejects(svc.getAssignmentDetail(OTHER, 'a1', { now: NOW }), (e) => e.statusCode === 404);
  await assert.rejects(svc.getExamDetail(OTHER, 'e1', { now: NOW }), (e) => e.statusCode === 404);
  await assert.rejects(svc.getStudentTimeline(OTHER, 'exam', 'e1', 's1'), (e) => e.statusCode === 404);
});

test('cards never read the activity event log', async () => {
  queries.length = 0;
  await svc.getMaterialSummaries(OWNER, { now: NOW });
  await svc.getAssignmentSummaries(OWNER, { now: NOW });
  await svc.getExamSummaries(OWNER, { now: NOW });
  assert.ok(queries.length > 0);
  assert.equal(queries.filter((q) => /student_activity_log/.test(q)).length, 0);
});
