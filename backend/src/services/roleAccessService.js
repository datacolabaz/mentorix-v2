/**
 * Permission-based roles: what a person may do is derived from server-side grants, and the teacher
 * permission is granted only by a platform admin (super_admin) or an organization admin.
 * A profile / cabinet switch can only move between roles the person already holds.
 */
const db = require('../utils/db');
const {
  ACCESS_ROLES,
  ORG_ROLES_THAT_APPROVE_TEACHERS,
  accessRolesFromGrants,
  requiresApproval,
} = require('../config/accessRoles');
const { FEATURE_FLAGS } = require('../constants/featureFlags');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class RoleAccessError extends Error {
  constructor(message, statusCode = 400, code = 'ROLE_ACCESS') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

function cleanText(v, max) {
  const s = String(v ?? '').replace(/\u0000/g, '').trim();
  return s.length > max ? s.slice(0, max) : s;
}

async function isTeacherApprovalRequired() {
  try {
    const { isFeatureEnabled } = require('./featureFlagService');
    return await isFeatureEnabled(FEATURE_FLAGS.TEACHER_ROLE_APPROVAL);
  } catch {
    return true;
  }
}

async function isPlatformAdmin(userId) {
  const { rows } = await db.query(
    `SELECT 1 FROM users WHERE id = $1 AND role = 'admin' AND COALESCE(is_active, TRUE) = TRUE LIMIT 1`,
    [userId],
  );
  return Boolean(rows[0]);
}

/** Storage roles the person really holds (user_roles + inferred legacy/profile/enrollment grants). */
async function getHeldStorageRoles(userId) {
  const { getLoginEligibleRoles } = require('./userRolesService');
  const held = new Set(await getLoginEligibleRoles(userId));
  if (await isPlatformAdmin(userId)) held.add('admin');
  return [...held];
}

async function userHoldsStorageRole(userId, storageRole) {
  const role = String(storageRole || '').trim().toLowerCase();
  if (!role) return false;
  return (await getHeldStorageRoles(userId)).includes(role);
}

async function listOrgMemberships(userId) {
  try {
    const { rows } = await db.query(
      `SELECT m.course_id, m.role_key, c.name
       FROM org_memberships m
       JOIN courses c ON c.id = m.course_id
       WHERE m.user_id = $1 AND COALESCE(c.is_organization, FALSE) = TRUE`,
      [userId],
    );
    return rows;
  } catch (err) {
    if (err?.code === '42P01' || err?.code === '42703') return [];
    throw err;
  }
}

/** Organizations whose teacher requests this user may review. */
async function reviewableOrganizationIds(userId) {
  const memberships = await listOrgMemberships(userId);
  return memberships
    .filter((m) => ORG_ROLES_THAT_APPROVE_TEACHERS.includes(String(m.role_key || '')))
    .map((m) => String(m.course_id));
}

async function resolveAccessRoles(userId) {
  const [storageRoles, memberships] = await Promise.all([getHeldStorageRoles(userId), listOrgMemberships(userId)]);
  return accessRolesFromGrants({ storageRoles, orgRoleKeys: memberships.map((m) => m.role_key) });
}

function mapRequest(row) {
  if (!row) return null;
  return {
    id: row.id,
    user_id: row.user_id,
    requested_role: row.requested_role,
    organization_id: row.organization_id || null,
    organization_name: row.organization_name || null,
    status: row.status,
    note: row.note || null,
    source: row.source,
    reviewed_by: row.reviewed_by || null,
    reviewed_by_name: row.reviewed_by_name || null,
    reviewed_at: row.reviewed_at || null,
    review_reason: row.review_reason || null,
    created_at: row.created_at,
    ...(row.user_full_name !== undefined
      ? { user: { id: row.user_id, full_name: row.user_full_name, email: row.user_email || null } }
      : {}),
  };
}

const REQUEST_SELECT = `SELECT rr.*, c.name AS organization_name, rv.full_name AS reviewed_by_name,
       u.full_name AS user_full_name, u.email AS user_email
  FROM role_requests rr
  JOIN users u ON u.id = rr.user_id
  LEFT JOIN courses c ON c.id = rr.organization_id
  LEFT JOIN users rv ON rv.id = rr.reviewed_by`;

async function latestTeacherRequest(userId) {
  try {
    const { rows } = await db.query(
      `${REQUEST_SELECT} WHERE rr.user_id = $1 AND rr.requested_role = 'teacher'
       ORDER BY rr.created_at DESC LIMIT 1`,
      [userId],
    );
    return mapRequest(rows[0]);
  } catch (err) {
    if (err?.code === '42P01') return null;
    throw err;
  }
}

/** Access summary attached to /auth/me and every session payload. */
async function getAccessSummary(userId) {
  const [accessRoles, teacherRequest, approvalRequired, reviewOrgs, platformAdmin] = await Promise.all([
    resolveAccessRoles(userId),
    latestTeacherRequest(userId),
    isTeacherApprovalRequired(),
    reviewableOrganizationIds(userId),
    isPlatformAdmin(userId),
  ]);
  return {
    access_roles: accessRoles,
    teacher_request: teacherRequest
      ? {
          id: teacherRequest.id,
          status: teacherRequest.status,
          created_at: teacherRequest.created_at,
          reviewed_at: teacherRequest.reviewed_at,
          review_reason: teacherRequest.status === 'rejected' ? teacherRequest.review_reason : null,
          organization_name: teacherRequest.organization_name,
        }
      : null,
    teacher_approval_required: approvalRequired,
    can_review_role_requests: platformAdmin || reviewOrgs.length > 0,
  };
}

/**
 * May this user enter a cabinet that maps to `storageRole` without an approval step?
 * @param {{ onboarding?: boolean }} opts  onboarding: first purpose choice — student/parent are self-service there.
 * @returns {Promise<{ allowed: boolean, approvalRequired?: boolean }>}
 */
async function checkStorageRoleEntry(userId, storageRole, { onboarding = false } = {}) {
  const role = String(storageRole || '').trim().toLowerCase();
  if (!role) return { allowed: false };
  if (role === 'course') {
    // Organization cabinet: only owners / admins of an organization. The 'course' panel role every teacher
    // holds is not enough; organizations come from an approved «Təşkilat yarat» request.
    const roles = await resolveAccessRoles(userId);
    return roles.includes('organization_admin') ? { allowed: true } : { allowed: false, organizationRequired: true };
  }
  if (await userHoldsStorageRole(userId, role)) return { allowed: true };
  if (requiresApproval(role)) {
    if (!(await isTeacherApprovalRequired())) return { allowed: true };
    return { allowed: false, approvalRequired: true };
  }
  // Student / parent memberships come from a teacher's invite or a parent link — or a first-time choice.
  return { allowed: Boolean(onboarding) };
}

async function assertOrganization(organizationId) {
  if (!organizationId) return null;
  if (!UUID_RE.test(String(organizationId))) throw new RoleAccessError('Təşkilat tapılmadı.', 404, 'ORG_NOT_FOUND');
  const { rows } = await db.query(
    `SELECT id, name FROM courses WHERE id = $1 AND COALESCE(is_organization, FALSE) = TRUE LIMIT 1`,
    [organizationId],
  );
  if (!rows[0]) throw new RoleAccessError('Təşkilat tapılmadı.', 404, 'ORG_NOT_FOUND');
  return rows[0];
}

async function notifyReviewers(request, requesterName) {
  try {
    const { notifyAdmins, createNotificationSafe } = require('./notificationService');
    const title = 'Yeni müəllim icazəsi sorğusu';
    const body = `${requesterName || 'İstifadəçi'} müəllim icazəsi istəyir. Təsdiqləyin və ya rədd edin.`;
    const base = {
      category: 'system',
      eventType: 'role_request_created',
      priority: 'HIGH',
      title,
      body,
      meta: { href: '/admin/role-requests', role_request_id: request.id },
      relatedEntityType: 'role_request',
      relatedEntityId: request.id,
      actorUserId: request.user_id,
      dedupeKey: `role_request:${request.id}`,
    };
    await notifyAdmins(base, { excludeUserIds: [request.user_id] });
    if (request.organization_id) {
      const { rows } = await db.query(
        `SELECT user_id FROM org_memberships WHERE course_id = $1 AND role_key = ANY($2::text[])`,
        [request.organization_id, ORG_ROLES_THAT_APPROVE_TEACHERS],
      );
      for (const r of rows) {
        if (String(r.user_id) === String(request.user_id)) continue;
        // eslint-disable-next-line no-await-in-loop
        await createNotificationSafe({ ...base, recipientId: r.user_id, meta: { ...base.meta, href: '/org/role-requests' } });
      }
    }
  } catch (err) {
    console.error('[role-requests] notify reviewers', err?.message || err);
  }
}

async function notifyRequester(request, approved) {
  try {
    const { createNotificationSafe } = require('./notificationService');
    await createNotificationSafe({
      recipientId: request.user_id,
      category: 'system',
      eventType: approved ? 'role_request_approved' : 'role_request_rejected',
      priority: 'HIGH',
      title: approved ? 'Müəllim icazəsi təsdiqləndi' : 'Müəllim icazəsi sorğusu rədd edildi',
      body: approved
        ? 'Artıq müəllim kabinetinə keçə bilərsiniz.'
        : request.review_reason
          ? `Səbəb: ${request.review_reason}`
          : 'Ətraflı məlumat üçün administratorla əlaqə saxlayın.',
      meta: { href: approved ? '/instructor' : '/settings' },
      relatedEntityType: 'role_request',
      relatedEntityId: request.id,
      actorUserId: request.reviewed_by || null,
      dedupeKey: `role_request_resolved:${request.id}`,
      email: true,
    });
  } catch (err) {
    console.error('[role-requests] notify requester', err?.message || err);
  }
}

/**
 * Creates (or returns the existing) pending teacher request. Idempotent for double clicks:
 * the partial unique index allows one pending request per user and role.
 */
async function requestTeacherRole(userId, { note = '', organizationId = null, source = 'settings' } = {}) {
  if (await userHoldsStorageRole(userId, 'instructor')) {
    return { status: 'already_granted', request: null, created: false };
  }
  const org = await assertOrganization(organizationId);
  const src = ['onboarding', 'settings', 'workspace_switch', 'organization'].includes(source) ? source : 'settings';
  const { rows: existing } = await db.query(
    `SELECT id FROM role_requests WHERE user_id = $1 AND requested_role = 'teacher' AND status = 'pending' LIMIT 1`,
    [userId],
  );
  if (existing[0]) {
    const { rows } = await db.query(`${REQUEST_SELECT} WHERE rr.id = $1`, [existing[0].id]);
    return { status: 'pending', request: mapRequest(rows[0]), created: false };
  }
  let inserted;
  try {
    const { rows } = await db.query(
      `INSERT INTO role_requests (user_id, requested_role, organization_id, note, source)
       VALUES ($1, 'teacher', $2, NULLIF($3, ''), $4)
       RETURNING id`,
      [userId, org?.id || null, cleanText(note, 1000), src],
    );
    inserted = rows[0];
  } catch (err) {
    if (err?.code !== '23505') throw err;
    // Parallel request won the race — return it.
    const { rows } = await db.query(
      `SELECT id FROM role_requests WHERE user_id = $1 AND requested_role = 'teacher' AND status = 'pending' LIMIT 1`,
      [userId],
    );
    inserted = rows[0];
    const { rows: full } = await db.query(`${REQUEST_SELECT} WHERE rr.id = $1`, [inserted.id]);
    return { status: 'pending', request: mapRequest(full[0]), created: false };
  }
  const { rows } = await db.query(`${REQUEST_SELECT} WHERE rr.id = $1`, [inserted.id]);
  const request = mapRequest(rows[0]);
  await notifyReviewers({ ...request, organization_id: request.organization_id }, request.user?.full_name);
  return { status: 'pending', request, created: true };
}

async function listMyRoleRequests(userId) {
  const { rows } = await db.query(`${REQUEST_SELECT} WHERE rr.user_id = $1 ORDER BY rr.created_at DESC LIMIT 20`, [userId]);
  return rows.map(mapRequest);
}

async function cancelMyRoleRequest(userId, requestId) {
  if (!UUID_RE.test(String(requestId))) throw new RoleAccessError('Sorğu tapılmadı.', 404, 'NOT_FOUND');
  const { rows } = await db.query(
    `UPDATE role_requests SET status = 'cancelled', updated_at = NOW()
     WHERE id = $1 AND user_id = $2 AND status = 'pending'
     RETURNING id`,
    [requestId, userId],
  );
  if (!rows[0]) throw new RoleAccessError('Gözləyən sorğu tapılmadı.', 404, 'NOT_FOUND');
  return { cancelled: true };
}

async function reviewerScope(reviewerId) {
  const platformAdmin = await isPlatformAdmin(reviewerId);
  const orgIds = platformAdmin ? [] : await reviewableOrganizationIds(reviewerId);
  if (!platformAdmin && !orgIds.length) {
    throw new RoleAccessError('Bu sorğulara baxmaq üçün icazəniz yoxdur.', 403, 'FORBIDDEN');
  }
  return { platformAdmin, orgIds };
}

async function listRoleRequestsForReviewer(reviewerId, { status = 'pending', limit = 100 } = {}) {
  const scope = await reviewerScope(reviewerId);
  const st = ['pending', 'approved', 'rejected', 'cancelled', 'all'].includes(status) ? status : 'pending';
  const cap = Math.min(Math.max(Number(limit) || 100, 1), 200);
  const params = [];
  const where = [];
  if (st !== 'all') {
    params.push(st);
    where.push(`rr.status = $${params.length}`);
  }
  if (!scope.platformAdmin) {
    params.push(scope.orgIds);
    where.push(`rr.organization_id = ANY($${params.length}::uuid[])`);
  }
  params.push(cap);
  const { rows } = await db.query(
    `${REQUEST_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY rr.created_at ${st === 'pending' ? 'ASC' : 'DESC'} LIMIT $${params.length}`,
    params,
  );
  return { requests: rows.map(mapRequest), scope: scope.platformAdmin ? 'platform' : 'organization' };
}

async function loadReviewableRequest(reviewerId, requestId) {
  if (!UUID_RE.test(String(requestId))) throw new RoleAccessError('Sorğu tapılmadı.', 404, 'NOT_FOUND');
  const scope = await reviewerScope(reviewerId);
  const { rows } = await db.query(`${REQUEST_SELECT} WHERE rr.id = $1`, [requestId]);
  const row = rows[0];
  if (!row) throw new RoleAccessError('Sorğu tapılmadı.', 404, 'NOT_FOUND');
  if (!scope.platformAdmin && !(row.organization_id && scope.orgIds.includes(String(row.organization_id)))) {
    // Do not reveal requests of other organizations.
    throw new RoleAccessError('Sorğu tapılmadı.', 404, 'NOT_FOUND');
  }
  if (String(row.user_id) === String(reviewerId)) {
    throw new RoleAccessError('Öz sorğunuzu təsdiqləyə bilməzsiniz.', 403, 'SELF_REVIEW');
  }
  return row;
}

/**
 * Approval grants the teacher *membership* only (user_roles). The person's active cabinet does not
 * change under them; they switch to the teacher cabinet themselves, which provisions the profile/trial.
 */
async function approveRoleRequest(reviewerId, requestId, { reason = '' } = {}) {
  const row = await loadReviewableRequest(reviewerId, requestId);
  if (row.status !== 'pending') throw new RoleAccessError('Bu sorğu artıq həll olunub.', 409, 'ALREADY_RESOLVED');
  const { grantUserRole } = require('./userRolesService');
  if (row.organization_id) {
    const { syncOrgPermissionCatalog } = require('./orgRbacService');
    await syncOrgPermissionCatalog();
  }
  const resolved = await db.transaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE role_requests
       SET status = 'approved', reviewed_by = $2, reviewed_at = NOW(), review_reason = NULLIF($3, ''), updated_at = NOW()
       WHERE id = $1 AND status = 'pending'
       RETURNING *`,
      [row.id, reviewerId, cleanText(reason, 500)],
    );
    if (!rows[0]) throw new RoleAccessError('Bu sorğu artıq həll olunub.', 409, 'ALREADY_RESOLVED');
    await grantUserRole(row.user_id, 'instructor', client);
    if (row.organization_id) {
      await client.query(
        `INSERT INTO org_memberships (course_id, user_id, role_key)
         VALUES ($1, $2, 'instructor')
         ON CONFLICT (course_id, user_id) DO NOTHING`,
        [row.organization_id, row.user_id],
      );
    }
    return rows[0];
  });
  if (row.organization_id) {
    const { writeOrgAudit } = require('./orgRbacService');
    await writeOrgAudit({
      courseId: row.organization_id,
      actorUserId: reviewerId,
      action: 'teacher_role_approved',
      targetType: 'user',
      targetId: row.user_id,
      metadata: { role_request_id: row.id },
    }).catch((err) => console.error('[role-requests] org audit', err?.message || err));
  }
  await notifyRequester({ ...resolved }, true);
  return { request: mapRequest({ ...row, ...resolved }) };
}

async function rejectRoleRequest(reviewerId, requestId, { reason = '' } = {}) {
  const row = await loadReviewableRequest(reviewerId, requestId);
  if (row.status !== 'pending') throw new RoleAccessError('Bu sorğu artıq həll olunub.', 409, 'ALREADY_RESOLVED');
  const { rows } = await db.query(
    `UPDATE role_requests
     SET status = 'rejected', reviewed_by = $2, reviewed_at = NOW(), review_reason = NULLIF($3, ''), updated_at = NOW()
     WHERE id = $1 AND status = 'pending'
     RETURNING *`,
    [row.id, reviewerId, cleanText(reason, 500)],
  );
  if (!rows[0]) throw new RoleAccessError('Bu sorğu artıq həll olunub.', 409, 'ALREADY_RESOLVED');
  await notifyRequester(rows[0], false);
  return { request: mapRequest({ ...row, ...rows[0] }) };
}

module.exports = {
  ACCESS_ROLES,
  RoleAccessError,
  isTeacherApprovalRequired,
  isPlatformAdmin,
  getHeldStorageRoles,
  userHoldsStorageRole,
  resolveAccessRoles,
  getAccessSummary,
  checkStorageRoleEntry,
  requestTeacherRole,
  listMyRoleRequests,
  cancelMyRoleRequest,
  listRoleRequestsForReviewer,
  approveRoleRequest,
  rejectRoleRequest,
  reviewableOrganizationIds,
};
