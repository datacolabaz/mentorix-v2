const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseReportQuery,
  applyReportQuery,
  enrichReportRow,
  reminderEligibleFor,
  reminderMessage,
  reminderMeta,
  planReminderRecipients,
  previewMessages,
  sanitizeTimelineEvent,
  REPORT_FILTERS,
  CARD_FILTER_PARITY,
  MAX_PAGE_SIZE,
} = require('./activityReportRules');

const G1 = '11111111-1111-4111-8111-111111111111';
const G2 = '22222222-2222-4222-8222-222222222222';

const ROWS = [
  { student_id: 'a', full_name: 'Aysel Məmmədova', status: 'completed', viewed: true, downloaded: true, last_activity_at: '2026-09-29T17:34:00Z', groups: [{ id: G1 }] },
  { student_id: 'b', full_name: 'Babək Əliyev', status: 'not_opened', viewed: false, downloaded: true, last_activity_at: '2026-09-20T08:00:00Z', groups: [{ id: G2 }] },
  { student_id: 'c', full_name: 'Cavid Həsənov', status: 'opened', viewed: false, downloaded: false, last_activity_at: null, groups: [] },
  { student_id: 'd', full_name: 'İlkin Quliyev', status: 'completed', viewed: true, downloaded: false, last_activity_at: '2026-09-30T19:59:00Z', groups: [{ id: G1 }, { id: G2 }] },
];

test('parseReportQuery keeps only known values and caps sizes', () => {
  const q = parseReportQuery(
    { filter: 'downloaded', status: 'DROP TABLE', group: 'nope', q: '  ay  ', page: '2', page_size: '9999' },
    'material',
  );
  assert.equal(q.filter, 'downloaded');
  assert.equal(q.status, null, 'non-snake status rejected');
  assert.equal(q.group, null, 'non-uuid group rejected');
  assert.equal(q.q, 'ay');
  assert.equal(q.paginate, true);
  assert.equal(q.page, 2);
  assert.equal(q.pageSize, MAX_PAGE_SIZE);
  assert.equal(parseReportQuery({ filter: 'not_a_filter' }, 'exam').filter, null);
  assert.equal(parseReportQuery({}, 'exam').paginate, false, 'no page param → full list (popover)');
});

test('date-only boundaries are whole Baku days', () => {
  const q = parseReportQuery({ from: '2026-09-29', to: '2026-09-30' }, 'material');
  assert.equal(q.from.toISOString(), '2026-09-28T20:00:00.000Z');
  assert.equal(q.to.toISOString(), '2026-09-30T19:59:59.999Z');
  const r = applyReportQuery(ROWS, q, 'material');
  assert.deepEqual(r.rows.map((s) => s.student_id), ['a', 'd'], 'no-activity rows are outside any range');
});

test('applyReportQuery combines filter, group, text and paginates', () => {
  const base = parseReportQuery({ filter: 'viewed' }, 'material');
  assert.deepEqual(applyReportQuery(ROWS, base, 'material').rows.map((s) => s.student_id), ['a', 'd']);
  const grouped = parseReportQuery({ group: G2 }, 'material');
  assert.deepEqual(applyReportQuery(ROWS, grouped, 'material').rows.map((s) => s.student_id), ['b', 'd']);
  const text = parseReportQuery({ q: 'İLKİN' }, 'material');
  assert.deepEqual(applyReportQuery(ROWS, text, 'material').rows.map((s) => s.student_id), ['d'], 'az-aware case folding');
  const status = parseReportQuery({ status: 'opened' }, 'material');
  assert.deepEqual(applyReportQuery(ROWS, status, 'material').rows.map((s) => s.student_id), ['c']);

  const p1 = applyReportQuery(ROWS, parseReportQuery({ page: '1', page_size: '3' }, 'material'), 'material');
  const p2 = applyReportQuery(ROWS, parseReportQuery({ page: '2', page_size: '3' }, 'material'), 'material');
  assert.equal(p1.total, 4);
  assert.equal(p1.total_pages, 2);
  assert.deepEqual([...p1.rows, ...p2.rows].map((s) => s.student_id), ['a', 'b', 'c', 'd']);
  const beyond = applyReportQuery(ROWS, parseReportQuery({ page: '9', page_size: '3' }, 'material'), 'material');
  assert.equal(beyond.page, 2, 'page is clamped to the last page');
});

test('every card parity entry points to an existing filter', () => {
  for (const [type, map] of Object.entries(CARD_FILTER_PARITY)) {
    for (const [field, filter] of Object.entries(map)) {
      if (filter) assert.ok(REPORT_FILTERS[type][filter], `${type}.${field} → ${filter}`);
    }
  }
});

test('enrichReportRow takes the earliest first activity and keeps the card last activity', () => {
  const row = enrichReportRow(
    { student_id: 'a', first_activity_at: '2026-09-29T10:00:00Z', last_activity_at: '2026-09-30T10:00:00Z' },
    { logStats: { first_activity_at: new Date('2026-09-28T10:00:00Z'), activity_count: '7' }, groups: [{ id: G1, name: 'A' }] },
  );
  assert.equal(row.first_activity_at, '2026-09-28T10:00:00.000Z');
  assert.equal(row.last_activity_at, '2026-09-30T10:00:00Z');
  assert.equal(row.activity_count, 7);
  assert.equal(row.groups.length, 1);
  assert.equal(enrichReportRow({ student_id: 'x' }).activity_count, 0);
});

test('reminder target list per entity type', () => {
  assert.equal(reminderEligibleFor('material', { viewed: false, downloaded: true }), true, 'download is not a view');
  assert.equal(reminderEligibleFor('material', { viewed: true }), false);
  assert.equal(reminderEligibleFor('assignment', { submitted: false, returned: true }), true);
  assert.equal(reminderEligibleFor('assignment', { submitted: true }), false);
  assert.equal(reminderEligibleFor('exam', { started: false, expired: false, completed: false }), true);
  assert.equal(reminderEligibleFor('exam', { started: true }), false, 'in-progress students are not nagged');
  assert.equal(reminderEligibleFor('exam', { started: false, expired: true }), false, 'expired_no_answers waits for late access');
  assert.equal(reminderEligibleFor('partner', {}), false);
});

test('planReminderRecipients separates recipients, cooldown and not eligible', () => {
  const now = new Date('2026-10-01T10:00:00Z');
  const plan = planReminderRecipients({
    entityType: 'material',
    candidates: [
      { student_id: 'a', full_name: 'A', viewed: false, status: 'not_opened' },
      { student_id: 'b', full_name: 'B', viewed: false, status: 'opened' },
      { student_id: 'c', full_name: 'C', viewed: true, status: 'completed' },
    ],
    recentSentAt: new Map([['b', '2026-10-01T08:00:00Z']]),
    cooldownHours: 6,
    now,
  });
  assert.deepEqual(plan.recipients.map((r) => r.student_id), ['a']);
  assert.deepEqual(plan.recently_reminded.map((r) => r.student_id), ['b']);
  assert.equal(plan.recently_reminded[0].next_allowed_at, '2026-10-01T14:00:00.000Z');
  assert.deepEqual(plan.not_eligible.map((r) => r.student_id), ['c']);

  const closed = planReminderRecipients({ entityType: 'exam', candidates: [{ student_id: 'a', started: false }], cooldownHours: 6, closed: true });
  assert.equal(closed.recipients.length, 0, 'closed exam: nobody is reminded');
});

test('reminder message is localized, title-only and carries a deep link', () => {
  const az = reminderMessage('exam', 'Riyaziyyat KSQ 1', 'az');
  assert.equal(az.title, 'Xatırlatma');
  assert.match(az.body, /«Riyaziyyat KSQ 1» imtahanına/);
  assert.equal(reminderMessage('material', 'X', 'en-US').locale, 'en');
  assert.equal(reminderMessage('material', 'X', 'tr').locale, 'az', 'unknown locale → az');
  assert.match(reminderMessage('assignment', 'Faiz', 'ru').body, /задание «Faiz»/);
  assert.deepEqual(reminderMeta('exam', 'e1'), { exam_id: 'e1', href: '/student/exams' });
  assert.deepEqual(reminderMeta('material', 'm1'), { material_id: 'm1', href: '/student/materials' });
  const msgs = previewMessages('material', 'X', [{ student_id: 'a' }, { student_id: 'b' }, { student_id: 'c' }], new Map([['a', 'en'], ['b', 'az'], ['c', 'az']]));
  assert.deepEqual(msgs.map((m) => [m.locale, m.count]), [['az', 2], ['en', 1]]);
});

test('timeline events never expose answers, scores or free-form metadata', () => {
  const ev = sanitizeTimelineEvent({
    event_type: 'exam_expired',
    created_at: '2026-09-29T17:34:00Z',
    source: 'server',
    metadata: { outcome: 'auto_submitted', answers: { q1: 'B' }, score: 7, token: 'secret', answered_count: 3 },
  });
  assert.deepEqual(ev, {
    event_type: 'exam_expired',
    at: '2026-09-29T17:34:00.000Z',
    source: 'server',
    details: { outcome: 'auto_submitted', answered_count: 3 },
  });
});
