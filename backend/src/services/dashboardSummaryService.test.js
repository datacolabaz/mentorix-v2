const test = require('node:test');
const assert = require('node:assert/strict');

/**
 * Servis səviyyəsində sahiblik: hər sorğu yalnız çağıranın öz ID-si ilə işləyir, admin cavabında tələbə
 * səviyyəsində sahə yoxdur, bir sorğu yıxılsa yalnız həmin bənd «əlçatmaz» olur. DB əvəzlənir.
 */

const TEACHER = '11111111-1111-4111-8111-111111111111';
const STUDENT = '55555555-5555-4555-8555-555555555555';
const ADMIN = '33333333-3333-4333-8333-333333333333';
const NOW = new Date('2026-10-01T10:00:00Z');

const queries = [];
let failMarker = null;

const RESPONSES = {
  dash_teacher_materials: [{ not_viewed: 4, materials_with_unviewed: 2, overdue: 1 }],
  dash_teacher_assignments: [{ waiting_grading: 3, overdue: 2, overdue_assignments: 1 }],
  dash_teacher_exams: [{ pending_manual_grading: 1, auto_submitted: 1, expired_no_answers: 1 }],
  dash_teacher_unread_submissions: [{ n: 5 }],
  dash_teacher_activity_counts: [{ event_type: 'assignment_submitted', n: 2 }],
  dash_teacher_activity_latest: [
    { event_type: 'assignment_submitted', entity_type: 'assignment', entity_id: 'a1', created_at: NOW, student_name: 'Aysel', entity_title: 'Faiz' },
  ],
  dash_student_exams: [{ new_count: 1, upcoming: 1, next_deadline: '2026-10-03T08:00:00Z' }],
  dash_student_assignments: [{ new_count: 2, upcoming: 0, next_deadline: null, returned: 0, feedback_recent: 1 }],
  dash_student_materials: [{ new_count: 3 }],
  dash_student_results: [{ released: 1, latest_at: '2026-09-30T12:00:00Z' }],
  dash_student_join: [{ status: 'pending', group_name: '7A', at: '2026-09-30T10:00:00Z' }],
  dash_admin_security: [{ unread_notifications: 1, auth_failures: 4 }],
  dash_admin_partners: [{ pending: 2, oldest_at: '2026-09-20T08:00:00Z' }],
  dash_admin_deliveries: [{ last_24h: 1, last_7d: 3 }],
  dash_admin_jobs: [{ open_grading_failed: 0 }],
  dash_admin_commissions: [{ pending_payouts: 1, pending_payout_cents: 5000, pending_commissions: 0 }],
};

function marker(sql) {
  const m = /\/\*\s*(\w+)\s*\*\//.exec(sql);
  return m ? m[1] : 'unknown';
}

const db = {
  query: async (sql, params = []) => {
    const key = marker(sql);
    queries.push({ key, sql, params });
    if (failMarker && key === failMarker) throw new Error('boom');
    return { rows: RESPONSES[key] || [] };
  },
};
db.pool = db;

function mock(modPath, exports) {
  const id = require.resolve(modPath);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}
mock('../utils/db', db);
mock('./joinInvitationService', {
  countPendingJoinRequests: async (id) => {
    queries.push({ key: 'join_requests', params: [id] });
    return 2;
  },
});

const svc = require('./dashboardSummaryService');

test.beforeEach(() => {
  queries.length = 0;
  failMarker = null;
});

function uuidParams(q) {
  return (q.params || []).filter((p) => typeof p === 'string' && /^[0-9a-f-]{36}$/i.test(p));
}

test('teacher: every query is scoped to the teacher id and nothing else', async () => {
  const s = await svc.getTeacherSummary(TEACHER, { now: NOW });
  assert.ok(queries.length >= 6);
  for (const q of queries) {
    assert.deepEqual(uuidParams(q), [TEACHER], `${q.key} must use only the teacher id`);
    assert.equal(q.params[0], TEACHER, `${q.key}: $1 = instructor`);
  }
  const by = Object.fromEntries(s.items.map((i) => [i.key, i]));
  assert.equal(by.pending_grading.count, 4);
  assert.equal(by.join_requests.count, 2);
  assert.equal(by.unread_submissions.count, 5);
  const unread = queries.find((q) => q.key === 'dash_teacher_unread_submissions');
  assert.match(unread.sql, /n\.type = ANY\(\$2::text\[\]\)/);
  assert.deepEqual(unread.params[1], ['assignment_submitted', 'assignment_late_submitted', 'exam_submitted', 'exam_auto_submitted']);
  assert.equal(s.recent_activity.counts.submissions, 2);
  assert.equal(s.recent_activity.latest[0].entity_title, 'Faiz');
});

test('teacher: activity reads a bounded index range (instructor + 24h window + LIMIT)', async () => {
  await svc.getTeacherSummary(TEACHER, { now: NOW });
  for (const key of ['dash_teacher_activity_counts', 'dash_teacher_activity_latest']) {
    const q = queries.find((x) => x.key === key);
    assert.match(q.sql, /instructor_id = \$1 AND (l\.)?created_at >= \$2/);
    assert.match(q.sql, /LIMIT \$4/);
    assert.equal(q.params[1].toISOString(), '2026-09-30T10:00:00.000Z');
  }
});

test('student: every query uses only the student id; enrollment filter adds only that teacher', async () => {
  await svc.getStudentSummary(STUDENT, { now: NOW });
  for (const q of queries) {
    assert.deepEqual(uuidParams(q), [STUDENT], q.key);
    assert.match(q.sql, /student_id = \$1/, `${q.key} filters by the student`);
  }
  queries.length = 0;
  await svc.getStudentSummary(STUDENT, { instructorId: TEACHER, now: NOW });
  for (const q of queries.filter((x) => x.key !== 'dash_student_join')) {
    assert.deepEqual(uuidParams(q), [STUDENT, TEACHER], q.key);
  }
});

test('admin: aggregate only — no student/user level fields in the summary', async () => {
  const s = await svc.getAdminSummary(ADMIN, { now: NOW });
  const json = JSON.stringify(s);
  assert.doesNotMatch(json, /student_id|student_name|full_name|"email"|user_id|"ip"/);
  assert.equal(s.attention_total, 1 + 2 + 1 + 0 + 1);
  const sec = queries.find((q) => q.key === 'dash_admin_security');
  assert.equal(sec.params[0], ADMIN, 'security notifications are the admin’s own');
  assert.ok(sec.params[1].includes('admin_login_failures'));
  const del = queries.find((q) => q.key === 'dash_admin_deliveries');
  assert.match(del.sql, /channel = 'email'/);
  assert.equal(del.params[2], 'notification_delivery_failed', 'the hourly summary itself is not a failed delivery');
});

test('one failing source does not break the dashboard', async () => {
  failMarker = 'dash_teacher_exams';
  const s = await svc.getTeacherSummary(TEACHER, { now: NOW });
  const by = Object.fromEntries(s.items.map((i) => [i.key, i]));
  assert.equal(by.assessment_expiry.available, false);
  assert.equal(by.pending_grading.available, true);
  assert.equal(by.pending_grading.count, 3);
  assert.equal(by.unviewed_materials.count, 4);
});

test('admin operations: no addresses, user ids or notification ids', async () => {
  mock('./notificationQueueService', {
    failedEmailDeliverySummary: async () => ({ since_hours: 168, total: 1, groups: [{ error_code: 'smtp', template: 'x', count: 1 }] }),
    listFailedEmailDeliveries: async () => [
      { id: 'q1', notification_id: 'n1', user_id: STUDENT, event_type: 'assignment_assigned', error_code: 'smtp', retry_count: 3, failed_at: NOW },
    ],
  });
  const ops = await svc.getAdminOperations({ now: NOW });
  const json = JSON.stringify(ops);
  assert.doesNotMatch(json, new RegExp(STUDENT));
  assert.doesNotMatch(json, /notification_id|user_id/);
  assert.equal(ops.email.recent[0].error_code, 'smtp');
  assert.deepEqual(ops.omitted.map((o) => o.key), ['privacy_requests', 'cross_workspace_attempts']);
});
