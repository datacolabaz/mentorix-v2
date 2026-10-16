const test = require('node:test');
const assert = require('node:assert/strict');
const { ACCESS_ROLES, accessRolesFromGrants, requiresApproval } = require('./accessRoles');

test('six access roles', () => {
  assert.deepEqual(Object.values(ACCESS_ROLES).sort(), [
    'corporate_manager',
    'organization_admin',
    'parent',
    'student',
    'super_admin',
    'teacher',
  ]);
});

test('access roles are derived from storage roles and organization memberships', () => {
  assert.deepEqual(accessRolesFromGrants({ storageRoles: ['admin'] }), ['super_admin']);
  assert.deepEqual(accessRolesFromGrants({ storageRoles: ['instructor', 'course', 'student'] }), ['teacher', 'student']);
  assert.deepEqual(accessRolesFromGrants({ storageRoles: ['parent'], orgRoleKeys: ['owner'] }), ['organization_admin', 'parent']);
  assert.deepEqual(accessRolesFromGrants({ orgRoleKeys: ['manager'] }), ['corporate_manager']);
  assert.deepEqual(accessRolesFromGrants({ orgRoleKeys: ['viewer', 'evaluator'] }), []);
  assert.deepEqual(accessRolesFromGrants({ storageRoles: ['unknown', null] }), []);
  // course cabinet alone is not organization admin (every teacher holds it for their own panel)
  assert.deepEqual(accessRolesFromGrants({ storageRoles: ['course'] }), []);
});

test('teacher and education-centre cabinets need approval; student/parent do not', () => {
  assert.equal(requiresApproval('instructor'), true);
  assert.equal(requiresApproval('course'), true);
  assert.equal(requiresApproval('student'), false);
  assert.equal(requiresApproval('parent'), false);
});
