/**
 * Backend role / permission checks for the core modules. Use after `authenticate`.
 *
 *   router.get('/groups', authenticate, requireAccess('teacher', 'organization_admin'), handler)
 *   router.patch('/orgs/:orgId/groups/:id', authenticate, requireOrgPermission('groups.edit'), handler)
 *   const scope = await scopeFor(req)   // then scopeFilter(scope, {...}) in SQL
 *
 * Roles are the server-derived access roles (config/accessRoles.js); org permissions come from the
 * caller's org membership role (config/orgPermissions.js). The client cannot widen either.
 */
const { resolveAccessRoles } = require('../services/roleAccessService');
const { loadUserScope, hasOrgPermission, AccessError } = require('../services/accessScope');

function deny(res, err) {
  const status = err?.statusCode || 500;
  if (status >= 500) console.error('[access]', err);
  return res.status(status).json({
    success: false,
    code: err?.code || 'ERROR',
    message: status >= 500 ? 'Server xətası.' : err.message,
  });
}

/** Cached per request. */
async function scopeFor(req) {
  if (!req.user?.id) throw new AccessError('Giriş tələb olunur.', 401, 'UNAUTHENTICATED');
  if (!req.accessScope) req.accessScope = await loadUserScope(req.user.id);
  return req.accessScope;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function accessRolesFor(req) {
  if (!UUID_RE.test(String(req.user?.id || ''))) throw new AccessError('Giriş tələb olunur.', 401, 'UNAUTHENTICATED');
  if (!req.accessRoles) req.accessRoles = await resolveAccessRoles(req.user.id);
  return req.accessRoles;
}

/** Passes when the caller holds at least one of the access roles (super_admin always passes). */
function requireAccess(...roles) {
  const wanted = roles.flat().filter(Boolean);
  return async (req, res, next) => {
    try {
      const held = await accessRolesFor(req);
      if (held.includes('super_admin') || wanted.some((r) => held.includes(r))) return next();
      return deny(res, new AccessError('Bu əməliyyat üçün icazəniz yoxdur.', 403, 'ACCESS_ROLE_REQUIRED'));
    } catch (err) {
      return deny(res, err);
    }
  };
}

/**
 * Passes when the caller has `permission` in the organization named by the request
 * (default: req.params.orgId, then req.body.organization_id, then req.query.organization_id).
 */
function requireOrgPermission(permission, { orgIdFrom } = {}) {
  const pick =
    orgIdFrom ||
    ((req) => req.params?.orgId || req.body?.organization_id || req.query?.organization_id || null);
  return async (req, res, next) => {
    try {
      const orgId = pick(req);
      if (!orgId) return deny(res, new AccessError('Təşkilat göstərilməyib.', 400, 'ORG_REQUIRED'));
      const scope = await scopeFor(req);
      if (!hasOrgPermission(scope, orgId, permission)) {
        return deny(res, new AccessError('Bu təşkilatda bu əməliyyat üçün icazəniz yoxdur.', 403, 'ORG_PERMISSION_REQUIRED'));
      }
      req.organizationId = String(orgId);
      return next();
    } catch (err) {
      return deny(res, err);
    }
  };
}

module.exports = { requireAccess, requireOrgPermission, scopeFor, accessRolesFor };
