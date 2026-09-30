const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveActivityScope, normalizeReason, ADMIN_REASON_MAX } = require('./activityAccessPolicy');

const TEACHER_A = '11111111-1111-4111-8111-111111111111';
const TEACHER_B = '22222222-2222-4222-8222-222222222222';
const ADMIN = '33333333-3333-4333-8333-333333333333';

test('teacher sees only own workspace; ?instructor_id= of another teacher is ignored', () => {
  const s = resolveActivityScope({ id: TEACHER_A, role: 'instructor' }, { instructorId: TEACHER_B, reason: 'x'.repeat(20) });
  assert.equal(s.ok, true);
  assert.equal(s.ownerId, TEACHER_A);
  assert.equal(s.admin, null);
});

test('students, parents, partners, org users and role-less users are blocked', () => {
  for (const role of ['student', 'parent', 'partner', 'org_admin', 'org_member', null, undefined, 'superuser']) {
    const s = resolveActivityScope({ id: TEACHER_A, role }, { instructorId: TEACHER_A, reason: 'support ticket 42' });
    assert.equal(s.ok, false, `role ${role}`);
    assert.equal(s.status, 403);
    assert.equal(s.code, 'ACTIVITY_FORBIDDEN');
  }
  const anon = resolveActivityScope(null, {});
  assert.equal(anon.ok, false);
  assert.equal(anon.status, 401);
});

test('admin needs a target teacher and a reason', () => {
  const admin = { id: ADMIN, role: 'admin' };
  const noTarget = resolveActivityScope(admin, { reason: 'support ticket 42' });
  assert.equal(noTarget.status, 400);
  assert.equal(noTarget.code, 'ADMIN_TARGET_REQUIRED');
  const badTarget = resolveActivityScope(admin, { instructorId: 'not-a-uuid', reason: 'support ticket 42' });
  assert.equal(badTarget.code, 'ADMIN_TARGET_REQUIRED');
  const noReason = resolveActivityScope(admin, { instructorId: TEACHER_B });
  assert.equal(noReason.status, 400);
  assert.equal(noReason.code, 'ADMIN_REASON_REQUIRED');
  const blankReason = resolveActivityScope(admin, { instructorId: TEACHER_B, reason: '   \n  ' });
  assert.equal(blankReason.code, 'ADMIN_REASON_REQUIRED');
  const shortReason = resolveActivityScope(admin, { instructorId: TEACHER_B, reason: 'abc' });
  assert.equal(shortReason.code, 'ADMIN_REASON_REQUIRED');
  const ok = resolveActivityScope(admin, { instructorId: TEACHER_B, reason: '  Support   ticket #42 ' });
  assert.equal(ok.ok, true);
  assert.equal(ok.ownerId, TEACHER_B);
  assert.deepEqual(ok.admin, { targetInstructorId: TEACHER_B, reason: 'Support ticket #42' });
});

test('admin is read-only (reminders, deadlines are teacher actions)', () => {
  const s = resolveActivityScope({ id: ADMIN, role: 'admin' }, { instructorId: TEACHER_B, reason: 'support ticket 42', write: true });
  assert.equal(s.ok, false);
  assert.equal(s.status, 403);
  assert.equal(s.code, 'ADMIN_READ_ONLY');
  const teacherWrite = resolveActivityScope({ id: TEACHER_A, role: 'instructor' }, { write: true });
  assert.equal(teacherWrite.ok, true);
});

test('reason is normalized and capped', () => {
  assert.equal(normalizeReason(null), '');
  assert.equal(normalizeReason('a  b\tc'), 'a b c');
  assert.equal(normalizeReason('x'.repeat(ADMIN_REASON_MAX + 50)).length, ADMIN_REASON_MAX);
});
