const test = require('node:test');
const assert = require('node:assert/strict');
const r = require('./dashboardSummaryRules');

const NOW = new Date('2026-10-01T10:00:00Z');
const STUDENT_LEVEL_KEYS = /student_id|student_name|full_name|email|phone|user_id|ip/i;

function allKeys(value, out = []) {
  if (Array.isArray(value)) value.forEach((v) => allKeys(v, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      out.push(k);
      allKeys(v, out);
    }
  }
  return out;
}

test('scope: admin / instructor / student only; others 403, anonymous 401', () => {
  assert.deepEqual(r.resolveDashboardScope({ id: 'a', role: 'admin' }), { ok: true, kind: 'admin', userId: 'a' });
  assert.deepEqual(r.resolveDashboardScope({ id: 't', role: 'instructor' }), { ok: true, kind: 'teacher', userId: 't' });
  assert.deepEqual(r.resolveDashboardScope({ id: 's', role: 'STUDENT' }), { ok: true, kind: 'student', userId: 's' });
  for (const role of ['parent', 'course', 'partner', '', null]) {
    const res = r.resolveDashboardScope({ id: 'x', role });
    assert.equal(res.ok, false);
    assert.equal(res.status, 403, `role ${role}`);
  }
  assert.equal(r.resolveDashboardScope(null).status, 401);
  assert.equal(r.resolveDashboardScope({ role: 'admin' }).status, 401);
});

test('admin: aggregate counts, links to admin pages, omitted items documented, no student-level fields', () => {
  const s = r.buildAdminSummary(
    {
      security: { unread_notifications: 2, auth_failures: 7 },
      partners: { pending: 3, oldest_at: '2026-09-20T08:00:00Z' },
      deliveries: { last_24h: 1, last_7d: 4 },
      jobs: { open_grading_failed: 0 },
      commissions: { pending_payouts: 0, pending_payout_cents: 0, pending_commissions: 5 },
    },
    { now: NOW },
  );
  const by = Object.fromEntries(s.items.map((i) => [i.key, i]));
  assert.deepEqual(Object.keys(by), [
    'security_events',
    'partner_applications',
    'failed_email_deliveries',
    'failed_background_jobs',
    'commission_actions',
  ]);
  assert.equal(by.security_events.count, 2);
  assert.equal(by.security_events.detail.auth_failures_24h, 7);
  assert.equal(by.security_events.severity, 'critical');
  assert.equal(by.partner_applications.href, '/admin/partners?status=pending');
  assert.equal(by.partner_applications.detail.oldest_at, '2026-09-20T08:00:00.000Z');
  assert.equal(by.failed_email_deliveries.detail.last_7d, 4);
  assert.equal(by.failed_background_jobs.severity, 'ok');
  assert.equal(by.commission_actions.count, 5);
  assert.equal(by.commission_actions.href, '/admin/partners?tab=commissions');
  assert.equal(s.attention_total, 2 + 3 + 1 + 0 + 5);
  assert.deepEqual(s.omitted.map((o) => o.key), ['privacy_requests', 'cross_workspace_attempts']);
  for (const i of s.items) assert.match(i.href, /^\/(admin|notifications)/);
  const leaked = allKeys(s).filter((k) => STUDENT_LEVEL_KEYS.test(k));
  assert.deepEqual(leaked, []);
});

test('admin: a failed source marks only that item unavailable', () => {
  const s = r.buildAdminSummary({ partners: { pending: 1 } }, { now: NOW });
  const by = Object.fromEntries(s.items.map((i) => [i.key, i]));
  assert.equal(by.partner_applications.available, true);
  assert.equal(by.security_events.available, false);
  assert.equal(by.failed_email_deliveries.available, false);
  assert.equal(s.attention_total, 1);
});

test('teacher: pending grading = waiting assignments + manual exam grading; links to engagement tabs', () => {
  const s = r.buildTeacherSummary(
    {
      materials: { not_viewed: 4, materials_with_unviewed: 2, overdue: 1 },
      assignments: { waiting_grading: 3, overdue: 2, overdue_assignments: 1 },
      exams: { pending_manual_grading: 1, auto_submitted: 2, expired_no_answers: 1 },
      unreadSubmissions: 6,
      joinRequests: 2,
      activity: null,
    },
    { now: NOW },
  );
  const by = Object.fromEntries(s.items.map((i) => [i.key, i]));
  assert.equal(by.pending_grading.count, 4);
  assert.deepEqual(by.pending_grading.detail, { assignments: 3, exams: 1 });
  assert.equal(by.pending_grading.href, '/instructor/engagement?tab=assignments');
  assert.equal(by.overdue_assignments.count, 2);
  assert.equal(by.assessment_expiry.count, 3);
  assert.equal(by.unviewed_materials.count, 4);
  assert.equal(by.unviewed_materials.detail.materials, 2);
  assert.equal(by.unread_submissions.count, 6);
  assert.equal(by.join_requests.href, '/instructor/join-requests');
});

test('teacher: only exams waiting → pending grading links to exams tab', () => {
  const s = r.buildTeacherSummary({ assignments: { waiting_grading: 0 }, exams: { pending_manual_grading: 2 } });
  const pg = s.items.find((i) => i.key === 'pending_grading');
  assert.equal(pg.href, '/instructor/engagement?tab=exams');
});

test('recent activity: buckets counts, ignores unknown events, keeps 5 latest', () => {
  const a = r.summarizeRecentActivity(
    [
      { event_type: 'assignment_submitted', n: 2 },
      { event_type: 'assignment_late_submitted', n: 1 },
      { event_type: 'material_viewed', n: 4 },
      { event_type: 'reminder_sent', n: 9 },
    ],
    Array.from({ length: 7 }, (_, i) => ({ event_type: 'material_viewed', entity_type: 'material', entity_id: `m${i}`, created_at: NOW })),
  );
  assert.equal(a.counts.submissions, 3);
  assert.equal(a.counts.material_views, 4);
  assert.equal(a.total, 7);
  assert.equal(a.latest.length, 5);
  assert.equal(a.latest[0].at, NOW.toISOString());
});

test('student: upcoming = assignments + assessments, earliest deadline wins, join request breakdown', () => {
  const s = r.buildStudentSummary(
    {
      exams: { new_count: 1, upcoming: 1, next_deadline: '2026-10-03T08:00:00Z' },
      assignments: { new_count: 2, upcoming: 2, next_deadline: '2026-10-02T19:59:59Z', returned: 1, feedback_recent: 2 },
      materials: { new_count: 3 },
      results: { released: 1, latest_at: '2026-09-30T12:00:00Z' },
      join: [
        { status: 'pending', group_name: '7A', at: '2026-09-30T10:00:00Z' },
        { status: 'approved', group_name: '8B', at: '2026-09-29T10:00:00Z' },
      ],
    },
    { now: NOW },
  );
  const by = Object.fromEntries(s.items.map((i) => [i.key, i]));
  assert.equal(by.upcoming_deadlines.count, 3);
  assert.equal(by.upcoming_deadlines.detail.next_at, '2026-10-02T19:59:59.000Z');
  assert.equal(by.teacher_feedback.count, 3);
  assert.equal(by.new_materials.href, '/student/materials');
  assert.equal(s.group_join.pending, 1);
  assert.equal(s.group_join.approved_recent, 1);
  assert.equal(s.group_join.requests[0].group_name, '7A');
  for (const i of s.items) assert.match(i.href, /^\/student\//);
});

test('student: empty data → zero counts, no join block when the query failed', () => {
  const s = r.buildStudentSummary({ exams: { new_count: 0, upcoming: 0 }, join: null });
  const by = Object.fromEntries(s.items.map((i) => [i.key, i]));
  assert.equal(by.new_assessments.count, 0);
  assert.equal(by.new_assignments.available, false);
  assert.equal(by.upcoming_deadlines.count, 0);
  assert.equal(by.upcoming_deadlines.detail.next_at, null);
  assert.equal(s.group_join, null);
});

test('submission notification type pattern covers legacy and Phase F names, not reminders', () => {
  const re = new RegExp(r.SUBMISSION_NOTIFICATION_TYPE_RE);
  for (const t of ['assignment_submitted', 'assignment_late_submitted', 'exam_submitted', 'exam_auto_submitted']) {
    assert.ok(re.test(t), t);
  }
  for (const t of ['assignment_reminder', 'assignment_submitted_reminder', 'exam_result_released', 'submitted']) {
    assert.equal(re.test(t), false, t);
  }
});
