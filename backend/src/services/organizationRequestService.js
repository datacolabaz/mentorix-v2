/**
 * «Təşkilat yarat» requests. An organization (courses.is_organization = TRUE) and its owner membership are
 * created only when a platform admin approves the request — never from the client, never as a side effect
 * of opening /org. Approval is atomic and repeat-safe:
 *   - the request row is locked (FOR UPDATE) and must still be pending;
 *   - the organization insert relies on the existing partial unique index (one organization per owner),
 *     so a second approval or a parallel approval reuses the same organization;
 *   - one pending request per user is enforced by a partial unique index.
 */
const db = require('../utils/db');

const ORG_TYPES = Object.freeze(['education_center', 'school', 'company', 'other']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class OrgRequestError extends Error {
  constructor(message, statusCode = 400, code = 'ORG_REQUEST_INVALID', fields = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    if (fields) this.fields = fields;
  }
}

function cleanText(v, max) {
  const s = String(v ?? '').replace(/\u0000/g, '').replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max) : s;
}

/** Pure validation of the request form. */
function validateOrgRequestInput(body = {}) {
  const name = cleanText(body.name, 160);
  if (name.length < 2) throw new OrgRequestError('Təşkilatın adını yazın (ən azı 2 simvol).', 400, 'VALIDATION', ['name']);
  const orgType = String(body.org_type || body.type || 'education_center').trim().toLowerCase();
  if (!ORG_TYPES.includes(orgType)) throw new OrgRequestError('Təşkilatın növünü seçin.', 400, 'VALIDATION', ['org_type']);
  const description = String(body.description ?? '').replace(/\u0000/g, '').trim().slice(0, 1000);
  return { name, org_type: orgType, description: description || null };
}

async function isPlatformAdmin(userId) {
  const { rows } = await db.query(
    `SELECT 1 FROM users WHERE id = $1 AND role = 'admin' AND COALESCE(is_active, TRUE) = TRUE LIMIT 1`,
    [userId],
  );
  return Boolean(rows[0]);
}

/** Organizations this user may open as owner / admin (the organization cabinet). */
async function listManagedOrganizations(userId) {
  const { rows } = await db.query(
    `SELECT c.id, c.name, m.role_key, (c.owner_user_id = $1) AS is_owner
     FROM org_memberships m
     JOIN courses c ON c.id = m.course_id AND COALESCE(c.is_organization, FALSE) = TRUE
     WHERE m.user_id = $1 AND m.role_key IN ('owner', 'org_admin')
     ORDER BY CASE WHEN m.role_key = 'owner' THEN 0 ELSE 1 END, m.created_at ASC`,
    [userId],
  );
  return rows.map((r) => ({ id: r.id, name: r.name || 'Təşkilat', role_key: r.role_key, is_owner: r.is_owner === true }));
}

const SELECT = `SELECT r.*, u.full_name AS user_full_name, u.email AS user_email, rv.full_name AS reviewed_by_name
  FROM organization_requests r
  JOIN users u ON u.id = r.user_id
  LEFT JOIN users rv ON rv.id = r.reviewed_by`;

function mapRequest(r) {
  if (!r) return null;
  return {
    id: r.id,
    user_id: r.user_id,
    name: r.name,
    org_type: r.org_type,
    description: r.description || null,
    source: r.source,
    status: r.status,
    organization_id: r.organization_id || null,
    reviewed_by_name: r.reviewed_by_name || null,
    reviewed_at: r.reviewed_at || null,
    review_reason: r.review_reason || null,
    created_at: r.created_at,
    ...(r.user_full_name !== undefined ? { user: { id: r.user_id, full_name: r.user_full_name, email: r.user_email || null } } : {}),
  };
}

async function latestRequest(userId) {
  try {
    const { rows } = await db.query(`${SELECT} WHERE r.user_id = $1 ORDER BY r.created_at DESC LIMIT 1`, [userId]);
    return mapRequest(rows[0]);
  } catch (err) {
    if (err?.code === '42P01') return null;
    throw err;
  }
}

async function notify(input) {
  try {
    const svc = require('./notificationService');
    if (input.toAdmins) return await svc.notifyAdmins(input.payload, { excludeUserIds: [input.payload.actorUserId] });
    return await svc.createNotificationSafe(input.payload);
  } catch (err) {
    console.error('[org-requests] notify', err?.message || err);
    return null;
  }
}

/**
 * Creates (or returns the existing pending) request. Refused when the user already manages an organization.
 * @returns {{ request, created: boolean }}
 */
async function createOrganizationRequest(userId, body, { source = 'workspace' } = {}) {
  const v = validateOrgRequestInput(body);
  const managed = await listManagedOrganizations(userId);
  if (managed.length) {
    throw new OrgRequestError('Sizin artıq təşkilatınız var.', 409, 'ALREADY_HAS_ORGANIZATION');
  }
  const existing = await db.query(`${SELECT} WHERE r.user_id = $1 AND r.status = 'pending' LIMIT 1`, [userId]);
  if (existing.rows[0]) return { request: mapRequest(existing.rows[0]), created: false };
  let id;
  try {
    const { rows } = await db.query(
      `INSERT INTO organization_requests (user_id, name, org_type, description, source)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [userId, v.name, v.org_type, v.description, source === 'onboarding' ? 'onboarding' : 'workspace'],
    );
    id = rows[0].id;
  } catch (err) {
    if (err?.code !== '23505') throw err;
    const again = await db.query(`${SELECT} WHERE r.user_id = $1 AND r.status = 'pending' LIMIT 1`, [userId]);
    return { request: mapRequest(again.rows[0]), created: false };
  }
  const { rows } = await db.query(`${SELECT} WHERE r.id = $1`, [id]);
  const request = mapRequest(rows[0]);
  await notify({
    toAdmins: true,
    payload: {
      category: 'system',
      eventType: 'organization_request_created',
      priority: 'HIGH',
      title: 'Yeni təşkilat sorğusu',
      body: `${request.user?.full_name || 'İstifadəçi'} «${request.name}» təşkilatını yaratmaq istəyir.`,
      meta: { href: '/admin/role-requests?tab=organizations', organization_request_id: request.id },
      relatedEntityType: 'organization_request',
      relatedEntityId: request.id,
      actorUserId: userId,
      dedupeKey: `organization_request:${request.id}`,
    },
  });
  return { request, created: true };
}

async function cancelOrganizationRequest(userId, requestId) {
  if (!UUID_RE.test(String(requestId || ''))) throw new OrgRequestError('Sorğu tapılmadı.', 404, 'NOT_FOUND');
  const { rows } = await db.query(
    `UPDATE organization_requests SET status = 'cancelled', updated_at = NOW()
     WHERE id = $1 AND user_id = $2 AND status = 'pending' RETURNING id`,
    [requestId, userId],
  );
  if (!rows[0]) throw new OrgRequestError('Gözləyən sorğu tapılmadı.', 404, 'NOT_FOUND');
  return { cancelled: true };
}

async function assertReviewer(reviewerId) {
  if (!(await isPlatformAdmin(reviewerId))) {
    throw new OrgRequestError('Bu sorğulara yalnız platforma admini baxa bilər.', 403, 'FORBIDDEN');
  }
}

async function listOrganizationRequests(reviewerId, { status = 'pending', limit = 100 } = {}) {
  await assertReviewer(reviewerId);
  const st = ['pending', 'approved', 'rejected', 'cancelled', 'all'].includes(status) ? status : 'pending';
  const cap = Math.min(Math.max(Number(limit) || 100, 1), 200);
  const params = [];
  let where = '';
  if (st !== 'all') {
    params.push(st);
    where = `WHERE r.status = $1`;
  }
  params.push(cap);
  const { rows } = await db.query(
    `${SELECT} ${where} ORDER BY r.created_at ${st === 'pending' ? 'ASC' : 'DESC'} LIMIT $${params.length}`,
    params,
  );
  return rows.map(mapRequest);
}

/** Atomic approval: organization (reused if the owner already has one) + owner membership + course role. */
async function approveOrganizationRequest(reviewerId, requestId, { reason = '' } = {}) {
  await assertReviewer(reviewerId);
  if (!UUID_RE.test(String(requestId || ''))) throw new OrgRequestError('Sorğu tapılmadı.', 404, 'NOT_FOUND');
  const { syncOrgPermissionCatalog, writeOrgAudit } = require('./orgRbacService');
  const { grantUserRole } = require('./userRolesService');
  await syncOrgPermissionCatalog();
  const result = await db.transaction(async (client) => {
    const { rows } = await client.query(`SELECT * FROM organization_requests WHERE id = $1 FOR UPDATE`, [requestId]);
    const req = rows[0];
    if (!req) throw new OrgRequestError('Sorğu tapılmadı.', 404, 'NOT_FOUND');
    if (req.status !== 'pending') throw new OrgRequestError('Bu sorğu artıq həll olunub.', 409, 'ALREADY_RESOLVED');
    if (String(req.user_id) === String(reviewerId)) {
      throw new OrgRequestError('Öz sorğunuzu təsdiqləyə bilməzsiniz.', 403, 'SELF_REVIEW');
    }
    const { rows: org } = await client.query(
      `INSERT INTO courses (owner_user_id, name, is_organization)
       VALUES ($1, $2, TRUE)
       ON CONFLICT (owner_user_id)
         WHERE (COALESCE(is_organization, FALSE) = TRUE AND owner_user_id IS NOT NULL)
       DO UPDATE SET updated_at = NOW()
       RETURNING id, name`,
      [req.user_id, req.name],
    );
    const organizationId = org[0].id;
    await client.query(
      `INSERT INTO org_memberships (course_id, user_id, role_key)
       VALUES ($1, $2, 'owner')
       ON CONFLICT (course_id, user_id) DO UPDATE SET role_key = 'owner', updated_at = NOW()`,
      [organizationId, req.user_id],
    );
    await grantUserRole(req.user_id, 'course', client);
    await client.query(
      `INSERT INTO course_profiles (user_id, course_name) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING`,
      [req.user_id, req.name],
    );
    const { rows: updated } = await client.query(
      `UPDATE organization_requests
       SET status = 'approved', organization_id = $2, reviewed_by = $3, reviewed_at = NOW(),
           review_reason = NULLIF($4, ''), updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [req.id, organizationId, reviewerId, cleanText(reason, 500)],
    );
    return { request: updated[0], organization: org[0] };
  });
  await writeOrgAudit({
    courseId: result.organization.id,
    actorUserId: reviewerId,
    action: 'organization_created_from_request',
    targetType: 'user',
    targetId: result.request.user_id,
    metadata: { organization_request_id: result.request.id },
  }).catch((err) => console.error('[org-requests] audit', err?.message || err));
  await notify({
    payload: {
      recipientId: result.request.user_id,
      category: 'system',
      eventType: 'organization_request_approved',
      priority: 'HIGH',
      title: 'Təşkilatınız yaradıldı',
      body: `«${result.organization.name}» təsdiqləndi. «Kabinetlərim» bölməsindən təşkilat kabinetinə keçə bilərsiniz.`,
      meta: { href: '/org' },
      relatedEntityType: 'organization_request',
      relatedEntityId: result.request.id,
      actorUserId: reviewerId,
      dedupeKey: `organization_request_resolved:${result.request.id}`,
      email: true,
    },
  });
  return { request: mapRequest(result.request), organization: result.organization };
}

async function rejectOrganizationRequest(reviewerId, requestId, { reason = '' } = {}) {
  await assertReviewer(reviewerId);
  if (!UUID_RE.test(String(requestId || ''))) throw new OrgRequestError('Sorğu tapılmadı.', 404, 'NOT_FOUND');
  const { rows } = await db.query(
    `UPDATE organization_requests
     SET status = 'rejected', reviewed_by = $2, reviewed_at = NOW(), review_reason = NULLIF($3, ''), updated_at = NOW()
     WHERE id = $1 AND status = 'pending' AND user_id <> $2
     RETURNING *`,
    [requestId, reviewerId, cleanText(reason, 500)],
  );
  if (!rows[0]) throw new OrgRequestError('Gözləyən sorğu tapılmadı.', 409, 'ALREADY_RESOLVED');
  await notify({
    payload: {
      recipientId: rows[0].user_id,
      category: 'system',
      eventType: 'organization_request_rejected',
      priority: 'HIGH',
      title: 'Təşkilat sorğusu rədd edildi',
      body: rows[0].review_reason ? `Səbəb: ${rows[0].review_reason}` : 'Ətraflı məlumat üçün administratorla əlaqə saxlayın.',
      relatedEntityType: 'organization_request',
      relatedEntityId: rows[0].id,
      actorUserId: reviewerId,
      dedupeKey: `organization_request_resolved:${rows[0].id}`,
      email: true,
    },
  });
  return { request: mapRequest(rows[0]) };
}

module.exports = {
  ORG_TYPES,
  OrgRequestError,
  validateOrgRequestInput,
  listManagedOrganizations,
  latestRequest,
  createOrganizationRequest,
  cancelOrganizationRequest,
  listOrganizationRequests,
  approveOrganizationRequest,
  rejectOrganizationRequest,
};
