const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const dbPath = path.join(__dirname, '../utils/db.js');
const data = {
  assignments: {},
  studentAssignments: [],
  exams: {},
  examAssignments: [],
  groups: {},
  enrollments: [],
  joinRequests: {},
  partners: new Set(),
  materials: {},
};

require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    query: async (sql, params = []) => {
      if (/FROM assignments WHERE id/.test(sql)) {
        const a = data.assignments[params[0]];
        return { rows: a ? [a] : [] };
      }
      if (/FROM student_assignments WHERE assignment_id/.test(sql)) {
        const hit = data.studentAssignments.find((r) => r.assignment_id === params[0] && r.student_id === params[1]);
        return { rows: hit ? [{ '?column?': 1 }] : [] };
      }
      if (/FROM exams WHERE id/.test(sql)) {
        const e = data.exams[params[0]];
        return { rows: e ? [e] : [] };
      }
      if (/FROM exam_assignments WHERE exam_id/.test(sql)) {
        const hit = data.examAssignments.find((r) => r.exam_id === params[0] && r.student_id === params[1]);
        return { rows: hit ? [{ '?column?': 1 }] : [] };
      }
      if (/FROM instructor_groups WHERE id/.test(sql)) {
        const g = data.groups[params[0]];
        return { rows: g ? [g] : [] };
      }
      if (/FROM enrollments WHERE group_id/.test(sql)) {
        const hit = data.enrollments.find((r) => r.group_id === params[0] && r.student_id === params[1]);
        return { rows: hit ? [{ '?column?': 1 }] : [] };
      }
      if (/FROM student_join_requests WHERE id/.test(sql)) {
        const r = data.joinRequests[params[0]];
        return { rows: r ? [r] : [] };
      }
      if (/FROM partners WHERE user_id/.test(sql)) {
        return { rows: data.partners.has(params[0]) ? [{ '?column?': 1 }] : [] };
      }
      if (/FROM course_materials WHERE id/.test(sql)) {
        const m = data.materials[params[0]];
        return { rows: m ? [m] : [] };
      }
      if (/course_material_guest_students|assignment_material_links|exam_material_links|course_material_group_access|FROM student_assignments sa/.test(sql)) {
        return { rows: [] };
      }
      return { rows: [] };
    },
    transaction: async () => {
      throw new Error('not used');
    },
  },
};

const { resolveNotificationLink, targetFor, safeLegacyHref } = require('./notificationLinkResolver');

const T1 = '10000000-0000-4000-8000-000000000001';
const T2 = '10000000-0000-4000-8000-000000000002';
const S1 = '20000000-0000-4000-8000-000000000001';
const S2 = '20000000-0000-4000-8000-000000000002';
const A1 = '30000000-0000-4000-8000-000000000001';
const E1 = '40000000-0000-4000-8000-000000000001';
const G1 = '50000000-0000-4000-8000-000000000001';
const J1 = '60000000-0000-4000-8000-000000000001';
const M1 = '70000000-0000-4000-8000-000000000001';

data.assignments[A1] = { id: A1, instructor_id: T1 };
data.studentAssignments.push({ assignment_id: A1, student_id: S1 });
data.exams[E1] = { id: E1, instructor_id: T1, is_deleted: false };
data.examAssignments.push({ exam_id: E1, student_id: S1 });
data.groups[G1] = { id: G1, instructor_id: T1 };
data.enrollments.push({ group_id: G1, student_id: S1 });
data.joinRequests[J1] = { instructor_id: T1 };
data.materials[M1] = { id: M1, instructor_id: T1, assignment_id: null };
data.partners.add(S2);

const note = (userId, extra) => ({ id: 'n1', user_id: userId, type: 'x', meta: {}, ...extra });

test('a notification that belongs to someone else never resolves', async () => {
  const n = note(S1, { related_entity_type: 'assignment', related_entity_id: A1 });
  assert.deepEqual(await resolveNotificationLink(n, { id: S2, role: 'student' }), { href: null, status: 'forbidden' });
});

test('assignment: assigned student and owning teacher pass, others are re-checked and blocked', async () => {
  assert.deepEqual(
    await resolveNotificationLink(note(S1, { related_entity_type: 'assignment', related_entity_id: A1 }), { id: S1, role: 'student' }),
    { href: '/student/assignments', status: 'ok' },
  );
  assert.deepEqual(
    await resolveNotificationLink(note(T1, { related_entity_type: 'assignment', related_entity_id: A1 }), { id: T1, role: 'instructor' }),
    { href: '/instructor/tasks', status: 'ok' },
  );
  // Student removed from the assignment after the notification was created.
  assert.equal(
    (await resolveNotificationLink(note(S2, { related_entity_type: 'assignment', related_entity_id: A1 }), { id: S2, role: 'student' })).status,
    'forbidden',
  );
  // Another teacher's workspace.
  assert.equal(
    (await resolveNotificationLink(note(T2, { related_entity_type: 'assignment', related_entity_id: A1 }), { id: T2, role: 'instructor' })).status,
    'forbidden',
  );
});

test('legacy rows: meta.assignment_id / meta.exam_id are re-checked too', async () => {
  assert.equal(
    (await resolveNotificationLink(note(S2, { type: 'assignment_new', meta: { assignment_id: A1 } }), { id: S2, role: 'student' })).status,
    'forbidden',
  );
  assert.deepEqual(
    await resolveNotificationLink(note(S1, { type: 'exam', meta: JSON.stringify({ exam_id: E1 }) }), { id: S1, role: 'student' }),
    { href: '/student/exams', status: 'ok' },
  );
  assert.equal(
    (await resolveNotificationLink(note(S2, { type: 'exam_access_approved', meta: { exam_id: E1 } }), { id: S2, role: 'student' })).status,
    'forbidden',
  );
});

test('deleted or missing entities give a safe not_found', async () => {
  const missing = '99999999-0000-4000-8000-000000000000';
  assert.deepEqual(
    await resolveNotificationLink(note(T1, { related_entity_type: 'exam', related_entity_id: missing }), { id: T1, role: 'instructor' }),
    { href: null, status: 'not_found' },
  );
});

test('join request: only the owning teacher', async () => {
  assert.deepEqual(
    await resolveNotificationLink(note(T1, { related_entity_type: 'join_request', related_entity_id: J1 }), { id: T1, role: 'instructor' }),
    { href: '/instructor/join-requests', status: 'ok' },
  );
  assert.equal(
    (await resolveNotificationLink(note(T2, { related_entity_type: 'join_request', related_entity_id: J1 }), { id: T2, role: 'instructor' })).status,
    'forbidden',
  );
  assert.equal(
    (await resolveNotificationLink(note(S1, { type: 'join_request' }), { id: S1, role: 'student' })).status,
    'forbidden',
  );
});

test('group: owner teacher and enrolled student only', async () => {
  assert.equal(
    (await resolveNotificationLink(note(S1, { related_entity_type: 'group', related_entity_id: G1 }), { id: S1, role: 'student' })).href,
    '/student/groups',
  );
  assert.equal(
    (await resolveNotificationLink(note(S2, { related_entity_type: 'group', related_entity_id: G1 }), { id: S2, role: 'student' })).status,
    'forbidden',
  );
});

test('material reminder: student without material access is blocked', async () => {
  assert.equal(
    (await resolveNotificationLink(note(S2, { type: 'material_reminder', meta: { material_id: M1 } }), { id: S2, role: 'student' })).status,
    'forbidden',
  );
  assert.equal(
    (await resolveNotificationLink(note(T1, { type: 'material_reminder', meta: { material_id: M1 } }), { id: T1, role: 'instructor' })).href,
    '/instructor/materials',
  );
});

test('partner notifications require a partner membership', async () => {
  assert.equal(
    (await resolveNotificationLink(note(S2, { type: 'partner_payout_paid' }), { id: S2, role: 'student' })).href,
    '/partner/dashboard',
  );
  assert.equal(
    (await resolveNotificationLink(note(S1, { type: 'partner_payout_paid' }), { id: S1, role: 'student' })).status,
    'forbidden',
  );
});

test('legacy meta.href is only honoured for safe internal paths of the same role', () => {
  assert.equal(safeLegacyHref('/student/assignments?x=1', 'student'), '/student/assignments?x=1');
  assert.equal(safeLegacyHref('/admin/billing', 'student'), null);
  assert.equal(safeLegacyHref('//evil.example', 'student'), null);
  assert.equal(safeLegacyHref('https://evil.example', 'student'), null);
  assert.equal(safeLegacyHref('/\\evil', 'student'), null);
  assert.equal(safeLegacyHref('/notifications', 'instructor'), '/notifications');
  assert.equal(safeLegacyHref('/random-page', 'instructor'), null);
});

test('rows without any target resolve to none', async () => {
  assert.equal(targetFor({ type: 'instructor_panel', meta: {} }), null);
  assert.deepEqual(await resolveNotificationLink(note(S1, { type: 'instructor_panel' }), { id: S1, role: 'student' }), {
    href: null,
    status: 'none',
  });
});
