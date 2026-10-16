/**
 * Platform access roles (what a person is allowed to do) on top of the existing storage roles.
 *
 * Storage stays as it is so no existing account breaks:
 *   users.role / user_roles.role  → 'admin' | 'instructor' | 'course' | 'student' | 'parent'
 *   org_memberships.role_key      → 'owner' | 'org_admin' | 'manager' | 'instructor' | 'evaluator' | 'viewer'
 *
 * Access roles are derived from those grants; they are never self-assigned by the client.
 */

const ACCESS_ROLES = Object.freeze({
  SUPER_ADMIN: 'super_admin',
  ORGANIZATION_ADMIN: 'organization_admin',
  TEACHER: 'teacher',
  STUDENT: 'student',
  PARENT: 'parent',
  CORPORATE_MANAGER: 'corporate_manager',
});

const ACCESS_ROLE_ORDER = Object.freeze([
  ACCESS_ROLES.SUPER_ADMIN,
  ACCESS_ROLES.ORGANIZATION_ADMIN,
  ACCESS_ROLES.CORPORATE_MANAGER,
  ACCESS_ROLES.TEACHER,
  ACCESS_ROLES.STUDENT,
  ACCESS_ROLES.PARENT,
]);

/**
 * Storage role → access role. 'course' (education-centre cabinet) is intentionally not mapped: every teacher
 * also holds it for their own course panel, so organization_admin comes only from an organization membership.
 */
const STORAGE_ROLE_TO_ACCESS = Object.freeze({
  admin: ACCESS_ROLES.SUPER_ADMIN,
  instructor: ACCESS_ROLES.TEACHER,
  student: ACCESS_ROLES.STUDENT,
  parent: ACCESS_ROLES.PARENT,
});

/** Organization membership role → access role. */
const ORG_ROLE_TO_ACCESS = Object.freeze({
  owner: ACCESS_ROLES.ORGANIZATION_ADMIN,
  org_admin: ACCESS_ROLES.ORGANIZATION_ADMIN,
  manager: ACCESS_ROLES.CORPORATE_MANAGER,
  instructor: ACCESS_ROLES.TEACHER,
});

/** Org roles allowed to approve a teacher request addressed to their organization. */
const ORG_ROLES_THAT_APPROVE_TEACHERS = Object.freeze(['owner', 'org_admin']);

/**
 * Storage roles a person may only receive through approval (admin or organization), never by
 * switching cabinets or changing persona in their profile.
 */
const APPROVAL_REQUIRED_STORAGE_ROLES = Object.freeze(['instructor', 'course']);

/** Roles that can be requested through role_requests (CHECK constraint mirrors this list). */
const REQUESTABLE_ROLES = Object.freeze([ACCESS_ROLES.TEACHER]);

function accessRolesFromGrants({ storageRoles = [], orgRoleKeys = [] } = {}) {
  const set = new Set();
  for (const r of storageRoles) {
    const mapped = STORAGE_ROLE_TO_ACCESS[String(r || '').trim().toLowerCase()];
    if (mapped) set.add(mapped);
  }
  for (const k of orgRoleKeys) {
    const mapped = ORG_ROLE_TO_ACCESS[String(k || '').trim().toLowerCase()];
    if (mapped) set.add(mapped);
  }
  return ACCESS_ROLE_ORDER.filter((r) => set.has(r));
}

function requiresApproval(storageRole) {
  return APPROVAL_REQUIRED_STORAGE_ROLES.includes(String(storageRole || '').trim().toLowerCase());
}

module.exports = {
  ACCESS_ROLES,
  ACCESS_ROLE_ORDER,
  STORAGE_ROLE_TO_ACCESS,
  ORG_ROLE_TO_ACCESS,
  ORG_ROLES_THAT_APPROVE_TEACHERS,
  APPROVAL_REQUIRED_STORAGE_ROLES,
  REQUESTABLE_ROLES,
  accessRolesFromGrants,
  requiresApproval,
};
