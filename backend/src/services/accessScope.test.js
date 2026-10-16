const test = require('node:test');
const assert = require('node:assert/strict');
const { scopeFilter, assertCanModify, hasOrgPermission, orgIdsWith } = require('./accessScope');

const ME = '11111111-1111-4111-8111-111111111111';
const ORG_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ORG_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const OTHER = '22222222-2222-4222-8222-222222222222';

const teacherInA = {
  userId: ME,
  isSuperAdmin: false,
  orgs: [{ organization_id: ORG_A, role_key: 'instructor', permissions: ['groups.view', 'content.view'] }],
};
const adminOfB = {
  userId: ME,
  isSuperAdmin: false,
  orgs: [{ organization_id: ORG_B, role_key: 'org_admin', permissions: ['groups.view', 'groups.edit', 'content.edit'] }],
};

test('scopeFilter: own rows + orgs where the role has the permission; placeholders appended', () => {
  const params = ['x'];
  const sql = scopeFilter(teacherInA, { table: 'instructor_groups', alias: 'g', permission: 'groups.view', params });
  assert.equal(sql, '(g.instructor_id = $2 OR g.organization_id = ANY($3::uuid[]))');
  assert.deepEqual(params, ['x', ME, [ORG_A]]);
});

test('scopeFilter: no org permission → owner only; created_by column for bank tables', () => {
  const params = [];
  assert.equal(scopeFilter(teacherInA, { table: 'bank_questions', permission: 'content.edit', params }), '(created_by = $1)');
  assert.deepEqual(params, [ME]);
});

test('scopeFilter: super admin sees all; unknown table / unsafe alias rejected', () => {
  assert.equal(scopeFilter({ userId: ME, isSuperAdmin: true, orgs: [] }, { table: 'exams', permission: 'x', params: [] }), 'TRUE');
  assert.throws(() => scopeFilter(teacherInA, { table: 'users', permission: 'x', params: [] }), /unknown table/);
  assert.throws(() => scopeFilter(teacherInA, { table: 'exams', alias: 'e; DROP', permission: 'x', params: [] }), /unsafe/);
});

test('assertCanModify: owner yes; org admin with permission yes; viewer of other org → 404', () => {
  assert.doesNotThrow(() => assertCanModify(teacherInA, { instructor_id: ME, organization_id: null }, { table: 'instructor_groups', permission: 'groups.edit' }));
  assert.doesNotThrow(() => assertCanModify(adminOfB, { instructor_id: OTHER, organization_id: ORG_B }, { table: 'instructor_groups', permission: 'groups.edit' }));
  assert.throws(
    () => assertCanModify(teacherInA, { instructor_id: OTHER, organization_id: ORG_A }, { table: 'instructor_groups', permission: 'groups.edit' }),
    (e) => e.statusCode === 404,
  );
  assert.throws(
    () => assertCanModify(adminOfB, { instructor_id: OTHER, organization_id: ORG_A }, { table: 'instructor_groups', permission: 'groups.edit' }),
    (e) => e.statusCode === 404,
  );
  assert.throws(() => assertCanModify(teacherInA, { instructor_id: OTHER, organization_id: null }, { table: 'instructor_groups', permission: 'groups.edit' }), (e) => e.statusCode === 404);
});

test('hasOrgPermission / orgIdsWith', () => {
  assert.equal(hasOrgPermission(teacherInA, ORG_A, 'groups.view'), true);
  assert.equal(hasOrgPermission(teacherInA, ORG_A, 'groups.edit'), false);
  assert.equal(hasOrgPermission(teacherInA, ORG_B, 'groups.view'), false);
  assert.deepEqual(orgIdsWith(adminOfB, 'content.edit'), [ORG_B]);
});
