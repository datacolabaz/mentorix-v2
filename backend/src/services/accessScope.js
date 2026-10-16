/**
 * Core access scope: who may see / change which rows of the organization-scoped tables.
 *
 * A row belongs to its creator (created_by, or instructor_id on the older tables) and optionally to an
 * organization (organization_id; NULL = the creator's personal workspace).
 *   - The creator can always read and change their own rows.
 *   - Members of the row's organization can read / change it only when their org role has the permission
 *     (config/orgPermissions.js, e.g. 'groups.view', 'content.edit').
 *   - super_admin (users.role = 'admin') sees everything.
 * Everything here is decided on the server; the client never sends its own scope.
 */
const db = require('../utils/db');
const { ROLE_PERMISSIONS } = require('../config/orgPermissions');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IDENT_RE = /^[a-z_][a-z0-9_]{0,62}$/;

/** Owner column per core table (older tables use instructor_id as created_by). */
const OWNER_COLUMNS = Object.freeze({
  instructor_subjects: 'instructor_id',
  instructor_groups: 'instructor_id',
  question_bank_topics: 'created_by',
  bank_questions: 'created_by',
  exams: 'instructor_id',
  course_materials: 'instructor_id',
  assignments: 'instructor_id',
});

class AccessError extends Error {
  constructor(message, statusCode = 403, code = 'FORBIDDEN') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

function ident(name) {
  const s = String(name || '');
  if (!IDENT_RE.test(s)) throw new Error(`unsafe SQL identifier: ${s}`);
  return s;
}

/** Loads the caller's scope once per request (cached on req by the middleware). */
async function loadUserScope(userId) {
  if (!UUID_RE.test(String(userId || ''))) throw new AccessError('Giriş tələb olunur.', 401, 'UNAUTHENTICATED');
  const { rows: userRows } = await db.query(
    `SELECT id, role FROM users WHERE id = $1 AND COALESCE(is_active, TRUE) = TRUE LIMIT 1`,
    [userId],
  );
  if (!userRows[0]) throw new AccessError('Giriş tələb olunur.', 401, 'UNAUTHENTICATED');
  let memberships = [];
  try {
    const { rows } = await db.query(
      `SELECT m.course_id AS organization_id, m.role_key
       FROM org_memberships m
       JOIN courses c ON c.id = m.course_id AND COALESCE(c.is_organization, FALSE) = TRUE
       WHERE m.user_id = $1`,
      [userId],
    );
    memberships = rows;
  } catch (err) {
    if (err?.code !== '42P01') throw err;
  }
  const orgs = memberships.map((m) => ({
    organization_id: String(m.organization_id),
    role_key: m.role_key,
    permissions: [...(ROLE_PERMISSIONS[m.role_key] || [])],
  }));
  return {
    userId: String(userRows[0].id),
    isSuperAdmin: String(userRows[0].role || '').toLowerCase() === 'admin',
    orgs,
  };
}

function orgIdsWith(scope, permission) {
  return scope.orgs.filter((o) => !permission || o.permissions.includes(permission)).map((o) => o.organization_id);
}

function hasOrgPermission(scope, organizationId, permission) {
  if (scope.isSuperAdmin) return true;
  const org = scope.orgs.find((o) => o.organization_id === String(organizationId || ''));
  return Boolean(org && (!permission || org.permissions.includes(permission)));
}

/**
 * SQL fragment that limits a query to rows the caller may read.
 * @param {object} scope   from loadUserScope
 * @param {{ table: string, alias?: string, permission: string, params: any[] }} opts
 *   params is the caller's parameter array; values are appended and placeholders returned in the SQL.
 * @returns {string} e.g. `(g.instructor_id = $3 OR g.organization_id = ANY($4::uuid[]))`
 */
function scopeFilter(scope, { table, alias = null, permission, params }) {
  if (!Array.isArray(params)) throw new Error('scopeFilter: params array required');
  const owner = OWNER_COLUMNS[table];
  if (!owner) throw new Error(`scopeFilter: unknown table ${table}`);
  if (scope.isSuperAdmin) return 'TRUE';
  const a = alias ? `${ident(alias)}.` : '';
  params.push(scope.userId);
  const ownerSql = `${a}${owner} = $${params.length}`;
  const orgIds = orgIdsWith(scope, permission);
  if (!orgIds.length) return `(${ownerSql})`;
  params.push(orgIds);
  return `(${ownerSql} OR ${a}organization_id = ANY($${params.length}::uuid[]))`;
}

/** Throws unless the caller may change this row (owner, org permission, or super_admin). */
function assertCanModify(scope, row, { table, permission }) {
  const owner = OWNER_COLUMNS[table];
  if (!owner) throw new Error(`assertCanModify: unknown table ${table}`);
  if (!row) throw new AccessError('Tapılmadı.', 404, 'NOT_FOUND');
  if (scope.isSuperAdmin) return;
  if (String(row[owner]) === scope.userId) return;
  if (row.organization_id && hasOrgPermission(scope, row.organization_id, permission)) return;
  // Same answer as "missing" so other organizations' rows don't leak their existence.
  throw new AccessError('Tapılmadı.', 404, 'NOT_FOUND');
}

/**
 * Validates an organization_id the caller wants to put on a new / moved row. NULL = personal workspace.
 * The organization must exist and the caller must hold `permission` there.
 */
async function resolveWritableOrganization(scope, organizationId, permission) {
  if (organizationId == null || organizationId === '') return null;
  const id = String(organizationId);
  if (!UUID_RE.test(id)) throw new AccessError('Təşkilat tapılmadı.', 404, 'ORG_NOT_FOUND');
  const { rows } = await db.query(
    `SELECT id FROM courses WHERE id = $1 AND COALESCE(is_organization, FALSE) = TRUE LIMIT 1`,
    [id],
  );
  if (!rows[0]) throw new AccessError('Təşkilat tapılmadı.', 404, 'ORG_NOT_FOUND');
  if (!hasOrgPermission(scope, id, permission)) {
    throw new AccessError('Bu təşkilatda bu əməliyyat üçün icazəniz yoxdur.', 403, 'ORG_PERMISSION_REQUIRED');
  }
  return id;
}

module.exports = {
  OWNER_COLUMNS,
  AccessError,
  loadUserScope,
  orgIdsWith,
  hasOrgPermission,
  scopeFilter,
  assertCanModify,
  resolveWritableOrganization,
};
