/**
 * «Kabinetlərim»: the cabinets this account may open, decided on the server from real grants.
 * The client renders this list only; every switch is checked again by POST /auth/switch-workspace.
 */
const db = require('../utils/db');
const { getAccessSummary } = require('./roleAccessService');
const { listManagedOrganizations, latestRequest } = require('./organizationRequestService');

async function partnerStatus(userId) {
  try {
    const { rows } = await db.query(`SELECT status FROM partners WHERE user_id = $1 LIMIT 1`, [userId]);
    return rows[0]?.status || null;
  } catch (err) {
    if (err?.code === '42P01' || err?.code === '42703') return null;
    throw err;
  }
}

async function listWorkspaces(userId) {
  const { rows } = await db.query(
    `SELECT id, role, persona, active_organization_id FROM users WHERE id = $1 LIMIT 1`,
    [userId],
  );
  const me = rows[0];
  if (!me) return null;
  const activeRole = String(me.role || '').toLowerCase();

  if (activeRole === 'admin') {
    return {
      active: { cabinet: 'admin', organization_id: null },
      cabinets: [{ key: 'admin', type: 'admin', label: 'Admin paneli', path: '/admin', active: true }],
      actions: [],
    };
  }

  const [summary, orgs, orgRequest, partner] = await Promise.all([
    getAccessSummary(userId),
    listManagedOrganizations(userId),
    latestRequest(userId),
    partnerStatus(userId),
  ]);
  const roles = summary.access_roles || [];
  const orgIds = orgs.map((o) => String(o.id));
  const activeOrgId =
    me.active_organization_id && orgIds.includes(String(me.active_organization_id))
      ? String(me.active_organization_id)
      : orgIds[0] || null;

  const cabinets = [];
  if (roles.includes('student')) {
    cabinets.push({ key: 'student', type: 'student', label: 'İştirakçı kabineti', path: '/student', active: activeRole === 'student' });
  }
  if (roles.includes('teacher')) {
    cabinets.push({ key: 'teacher', type: 'teacher', label: 'Müəllim kabineti', path: '/instructor', active: activeRole === 'instructor' });
  }
  for (const o of orgs) {
    cabinets.push({
      key: `organization:${o.id}`,
      type: 'organization',
      organization_id: o.id,
      label: o.name,
      role_key: o.role_key,
      path: '/org',
      active: activeRole === 'course' && String(o.id) === activeOrgId,
    });
  }
  if (roles.includes('parent')) {
    cabinets.push({ key: 'parent', type: 'parent', label: 'Valideyn kabineti', path: '/parent', active: activeRole === 'parent' });
  }
  if (partner) {
    cabinets.push({
      key: 'partner',
      type: 'partner',
      label: 'Partner kabineti',
      path: '/partner/dashboard',
      status: partner,
      active: false,
    });
  }

  const actions = [];
  if (!roles.includes('teacher')) {
    const tr = summary.teacher_request;
    actions.push({
      key: 'request_teacher',
      label: 'Müəllim icazəsi istə',
      status: tr?.status === 'pending' ? 'pending' : tr?.status === 'rejected' ? 'rejected' : 'available',
      review_reason: tr?.status === 'rejected' ? tr.review_reason || null : null,
    });
  }
  if (!orgs.length) {
    const pending = orgRequest?.status === 'pending';
    actions.push({
      key: 'create_organization',
      label: 'Təşkilat yarat',
      status: pending ? 'pending' : orgRequest?.status === 'rejected' ? 'rejected' : 'available',
      request: orgRequest && ['pending', 'rejected'].includes(orgRequest.status)
        ? { id: orgRequest.id, name: orgRequest.name, status: orgRequest.status, review_reason: orgRequest.review_reason }
        : null,
    });
  }

  return {
    active: {
      cabinet:
        activeRole === 'instructor' ? 'teacher' : activeRole === 'course' ? 'organization' : activeRole || null,
      organization_id: activeRole === 'course' ? activeOrgId : null,
    },
    cabinets,
    actions,
  };
}

/** Validates and stores the organization the organization cabinet should open. */
async function setActiveOrganization(userId, organizationId) {
  const orgs = await listManagedOrganizations(userId);
  const hit = orgs.find((o) => String(o.id) === String(organizationId || ''));
  if (!hit) {
    const err = new Error('Bu təşkilatda idarəetmə icazəniz yoxdur.');
    err.statusCode = 403;
    err.code = 'ORG_PERMISSION_REQUIRED';
    throw err;
  }
  await db.query(`UPDATE users SET active_organization_id = $2 WHERE id = $1`, [userId, hit.id]);
  return hit;
}

module.exports = { listWorkspaces, setActiveOrganization };
