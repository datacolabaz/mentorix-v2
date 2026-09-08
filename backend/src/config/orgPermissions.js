/** Organization RBAC catalog — add keys here, then seed via syncOrgPermissionCatalog(). */

const ORG_PERMISSIONS = Object.freeze([
  { key: 'dashboard.view', group_name: 'dashboard' },
  { key: 'users.view', group_name: 'users' },
  { key: 'users.create', group_name: 'users' },
  { key: 'users.edit', group_name: 'users' },
  { key: 'users.delete', group_name: 'users' },
  { key: 'trainers.view', group_name: 'trainers' },
  { key: 'trainers.invite', group_name: 'trainers' },
  { key: 'trainers.manage', group_name: 'trainers' },
  { key: 'teams.view', group_name: 'teams' },
  { key: 'teams.create', group_name: 'teams' },
  { key: 'teams.edit', group_name: 'teams' },
  { key: 'groups.view', group_name: 'groups' },
  { key: 'groups.create', group_name: 'groups' },
  { key: 'groups.edit', group_name: 'groups' },
  { key: 'assessments.view', group_name: 'assessments' },
  { key: 'assessments.create', group_name: 'assessments' },
  { key: 'assessments.edit', group_name: 'assessments' },
  { key: 'assessments.publish', group_name: 'assessments' },
  { key: 'content.view', group_name: 'content' },
  { key: 'content.create', group_name: 'content' },
  { key: 'content.edit', group_name: 'content' },
  { key: 'reports.view', group_name: 'reports' },
  { key: 'reports.export', group_name: 'reports' },
  { key: 'organization.manage', group_name: 'organization' },
  { key: 'roles.manage', group_name: 'organization' },
  { key: 'audit.view', group_name: 'system' },
  { key: 'notifications.manage', group_name: 'system' },
]);

const ORG_ROLES = Object.freeze([
  { key: 'owner', name_az: 'Sahib', sort_order: 0 },
  { key: 'org_admin', name_az: 'Təşkilat admini', sort_order: 1 },
  { key: 'manager', name_az: 'Menecer', sort_order: 2 },
  { key: 'instructor', name_az: 'Müəllim / Təlimçi', sort_order: 3 },
  { key: 'evaluator', name_az: 'Qiymətləndirici', sort_order: 4 },
  { key: 'viewer', name_az: 'İzləyici', sort_order: 5 },
]);

const ALL_KEYS = ORG_PERMISSIONS.map((p) => p.key);

const ROLE_PERMISSIONS = Object.freeze({
  owner: ALL_KEYS,
  org_admin: ALL_KEYS.filter((k) => k !== 'roles.manage'),
  manager: [
    'dashboard.view',
    'users.view',
    'users.create',
    'users.edit',
    'trainers.view',
    'teams.view',
    'teams.create',
    'teams.edit',
    'groups.view',
    'groups.create',
    'groups.edit',
    'assessments.view',
    'assessments.edit',
    'content.view',
    'reports.view',
    'reports.export',
  ],
  instructor: [
    'dashboard.view',
    'users.view',
    'groups.view',
    'assessments.view',
    'content.view',
    'reports.view',
  ],
  evaluator: [
    'dashboard.view',
    'users.view',
    'assessments.view',
    'reports.view',
    'reports.export',
  ],
  viewer: [
    'dashboard.view',
    'users.view',
    'teams.view',
    'groups.view',
    'assessments.view',
    'reports.view',
  ],
});

const ORG_ROLE_KEYS = Object.freeze({
  OWNER: 'owner',
  ORG_ADMIN: 'org_admin',
  MANAGER: 'manager',
  INSTRUCTOR: 'instructor',
  EVALUATOR: 'evaluator',
  VIEWER: 'viewer',
});

module.exports = {
  ORG_PERMISSIONS,
  ORG_ROLES,
  ROLE_PERMISSIONS,
  ALL_KEYS,
  ORG_ROLE_KEYS,
};
