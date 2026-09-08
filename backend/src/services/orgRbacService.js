const db = require('../utils/db');
const {
  ORG_PERMISSIONS,
  ORG_ROLES,
  ROLE_PERMISSIONS,
  ORG_ROLE_KEYS,
  ALL_KEYS,
} = require('../config/orgPermissions');

let catalogSynced = false;

async function syncOrgPermissionCatalog() {
  if (catalogSynced) return;
  for (const perm of ORG_PERMISSIONS) {
    await db.query(
      `INSERT INTO org_permissions (key, group_name)
       VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET group_name = EXCLUDED.group_name`,
      [perm.key, perm.group_name],
    );
  }
  for (const role of ORG_ROLES) {
    await db.query(
      `INSERT INTO org_roles (key, name_az, sort_order)
       VALUES ($1, $2, $3)
       ON CONFLICT (key) DO UPDATE SET name_az = EXCLUDED.name_az, sort_order = EXCLUDED.sort_order`,
      [role.key, role.name_az, role.sort_order],
    );
  }
  await db.query(`DELETE FROM org_role_permissions`);
  for (const [roleKey, keys] of Object.entries(ROLE_PERMISSIONS)) {
    for (const permissionKey of keys) {
      await db.query(
        `INSERT INTO org_role_permissions (role_key, permission_key)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [roleKey, permissionKey],
      );
    }
  }
  catalogSynced = true;
}

function permissionsForRole(roleKey) {
  return [...(ROLE_PERMISSIONS[roleKey] || [])];
}

async function ensureOwnerMembership(courseId, userId) {
  await syncOrgPermissionCatalog();
  await db.query(
    `INSERT INTO org_memberships (course_id, user_id, role_key)
     VALUES ($1, $2, $3)
     ON CONFLICT (course_id, user_id) DO UPDATE SET
       role_key = CASE
         WHEN org_memberships.role_key = 'owner' THEN org_memberships.role_key
         WHEN EXCLUDED.role_key = 'owner' THEN EXCLUDED.role_key
         ELSE org_memberships.role_key
       END,
       updated_at = NOW()`,
    [courseId, userId, ORG_ROLE_KEYS.OWNER],
  );
}

async function ensureStaffMembership(courseId, userId, roleKey = ORG_ROLE_KEYS.INSTRUCTOR) {
  await syncOrgPermissionCatalog();
  const key = ROLE_PERMISSIONS[roleKey] ? roleKey : ORG_ROLE_KEYS.INSTRUCTOR;
  await db.query(
    `INSERT INTO org_memberships (course_id, user_id, role_key)
     VALUES ($1, $2, $3)
     ON CONFLICT (course_id, user_id) DO UPDATE SET
       role_key = CASE
         WHEN org_memberships.role_key = 'owner' THEN org_memberships.role_key
         ELSE EXCLUDED.role_key
       END,
       updated_at = NOW()`,
    [courseId, userId, key],
  );
}

async function removeMembership(courseId, userId) {
  await db.query(
    `DELETE FROM org_memberships
     WHERE course_id = $1 AND user_id = $2 AND role_key <> 'owner'`,
    [courseId, userId],
  );
}

async function findActiveMembership(userId) {
  await syncOrgPermissionCatalog();
  const { rows } = await db.query(
    `SELECT m.course_id, m.role_key, m.user_id, c.owner_user_id, c.name, c.is_organization
     FROM org_memberships m
     JOIN courses c ON c.id = m.course_id
     WHERE m.user_id = $1 AND COALESCE(c.is_organization, FALSE) = TRUE
     ORDER BY CASE WHEN m.role_key = 'owner' THEN 0 ELSE 1 END, m.created_at ASC
     LIMIT 1`,
    [userId],
  );
  return rows[0] || null;
}

function hasPermission(permissions, key) {
  return Array.isArray(permissions) && permissions.includes(key);
}

function requirePermission(permissions, key) {
  if (!hasPermission(permissions, key)) {
    const err = new Error('Bu əməliyyat üçün icazəniz yoxdur');
    err.statusCode = 403;
    throw err;
  }
}

async function writeOrgAudit({
  courseId,
  actorUserId,
  action,
  targetType = null,
  targetId = null,
  metadata = {},
}) {
  await db.query(
    `INSERT INTO org_audit_events
       (course_id, actor_user_id, action, target_type, target_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [courseId, actorUserId || null, action, targetType, targetId != null ? String(targetId) : null, JSON.stringify(metadata || {})],
  );
}

async function listOrgAudit(courseId, { limit = 50, offset = 0 } = {}) {
  const { rows } = await db.query(
    `SELECT
       e.id,
       e.action,
       e.target_type,
       e.target_id,
       e.metadata,
       e.created_at,
       u.full_name AS actor_name,
       u.email AS actor_email
     FROM org_audit_events e
     LEFT JOIN users u ON u.id = e.actor_user_id
     WHERE e.course_id = $1
     ORDER BY e.created_at DESC
     LIMIT $2 OFFSET $3`,
    [courseId, Math.min(Number(limit) || 50, 200), Number(offset) || 0],
  );
  return rows;
}

async function listOrgRoles() {
  await syncOrgPermissionCatalog();
  const { rows: roles } = await db.query(
    `SELECT key, name_az, sort_order
     FROM org_roles
     ORDER BY sort_order ASC, name_az ASC`,
  );
  return roles.map((role) => ({
    ...role,
    permissions: permissionsForRole(role.key),
  }));
}

async function listOrgMembers(courseId) {
  await syncOrgPermissionCatalog();
  const { rows } = await db.query(
    `SELECT
       m.user_id AS id,
       m.role_key,
       r.name_az AS role_name,
       m.created_at,
       u.full_name,
       u.email,
       u.phone,
       u.last_activity_at,
       (c.owner_user_id = m.user_id) AS is_owner
     FROM org_memberships m
     JOIN org_roles r ON r.key = m.role_key
     JOIN users u ON u.id = m.user_id
     JOIN courses c ON c.id = m.course_id
     WHERE m.course_id = $1
     ORDER BY
       CASE m.role_key WHEN 'owner' THEN 0 ELSE 1 END,
       u.full_name ASC NULLS LAST`,
    [courseId],
  );
  return rows.map((row) => ({
    ...row,
    permissions: permissionsForRole(row.role_key),
  }));
}

async function updateMemberRole(courseId, userId, roleKey, actorUserId) {
  await syncOrgPermissionCatalog();
  if (!ROLE_PERMISSIONS[roleKey] || roleKey === ORG_ROLE_KEYS.OWNER) {
    const err = new Error('Rol tapılmadı və ya dəyişdirilə bilməz');
    err.statusCode = 400;
    throw err;
  }
  const { rows: member } = await db.query(
    `SELECT m.user_id, m.role_key, (c.owner_user_id = m.user_id) AS is_owner
     FROM org_memberships m
     JOIN courses c ON c.id = m.course_id
     WHERE m.course_id = $1 AND m.user_id = $2
     LIMIT 1`,
    [courseId, userId],
  );
  if (!member[0]) {
    const err = new Error('Üzv tapılmadı');
    err.statusCode = 404;
    throw err;
  }
  if (member[0].is_owner || member[0].role_key === ORG_ROLE_KEYS.OWNER) {
    const err = new Error('Təşkilat sahibinin rolunu dəyişmək olmaz');
    err.statusCode = 400;
    throw err;
  }
  await db.query(
    `UPDATE org_memberships SET role_key = $3, updated_at = NOW()
     WHERE course_id = $1 AND user_id = $2`,
    [courseId, userId, roleKey],
  );
  await writeOrgAudit({
    courseId,
    actorUserId,
    action: 'role.changed',
    targetType: 'user',
    targetId: userId,
    metadata: { from: member[0].role_key, to: roleKey },
  });
  return listOrgMembers(courseId);
}

function permissionCatalog() {
  return ORG_PERMISSIONS.map((p) => ({ ...p }));
}

module.exports = {
  ORG_PERMISSIONS,
  ORG_ROLE_KEYS,
  ALL_KEYS,
  syncOrgPermissionCatalog,
  permissionsForRole,
  ensureOwnerMembership,
  ensureStaffMembership,
  removeMembership,
  findActiveMembership,
  hasPermission,
  requirePermission,
  writeOrgAudit,
  listOrgAudit,
  listOrgRoles,
  listOrgMembers,
  updateMemberRole,
  permissionCatalog,
};
