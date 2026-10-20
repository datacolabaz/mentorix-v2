/**
 * Portal logins (/login/student, /login/instructor, /login/organization, /login/admin).
 * One account, many roles: the portal only *selects* which of the roles the account already holds becomes the
 * active cabinet. The check runs on the server before any token is issued; the client sends only the portal id.
 * Roles are never granted here (teacher access still goes through role requests).
 */
const db = require('../utils/db');
const { resolveAccessRoles } = require('./roleAccessService');

const PORTALS = Object.freeze({
  student: Object.freeze({
    id: 'student',
    accessRole: 'student',
    storageRole: 'student',
    persona: 'student',
    path: '/student',
    deniedMessage: 'Bu hesabda iştirakçı girişi üçün icazə yoxdur.',
  }),
  instructor: Object.freeze({
    id: 'instructor',
    accessRole: 'teacher',
    storageRole: 'instructor',
    persona: 'teacher',
    path: '/instructor',
    deniedMessage: 'Bu hesabda təlimçi girişi üçün icazə yoxdur.',
  }),
  organization: Object.freeze({
    id: 'organization',
    accessRole: 'organization_admin',
    storageRole: 'course',
    persona: 'education_center',
    path: '/org',
    deniedMessage: 'Bu hesabda təşkilat girişi üçün icazə yoxdur.',
  }),
  admin: Object.freeze({
    id: 'admin',
    accessRole: 'super_admin',
    storageRole: 'admin',
    persona: null,
    path: '/admin',
    deniedMessage: 'Bu hesabda admin girişi üçün icazə yoxdur.',
  }),
});

class PortalError extends Error {
  constructor(message, statusCode = 400, code = 'PORTAL_INVALID', extra = {}) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.extra = extra;
  }
}

/** null when no portal was requested (legacy behaviour); throws on an unknown portal id. */
function normalizePortal(raw) {
  if (raw == null || String(raw).trim() === '') return null;
  const key = String(raw).trim().toLowerCase();
  if (!PORTALS[key]) throw new PortalError('Giriş növü düzgün deyil.', 400, 'PORTAL_INVALID');
  return PORTALS[key];
}

function deniedError(portal, { canRegister = false } = {}) {
  return new PortalError(portal.deniedMessage, 403, 'PORTAL_ROLE_REQUIRED', {
    portal: portal.id,
    ...(canRegister ? { can_register: true } : {}),
  });
}

/** Throws PORTAL_ROLE_REQUIRED (403) unless the account really holds the portal's role. */
async function assertPortalAccess(userId, portal) {
  const roles = await resolveAccessRoles(userId);
  if (!roles.includes(portal.accessRole)) {
    throw deniedError(portal, { canRegister: roles.length === 0 && portal.id !== 'admin' });
  }
  return roles;
}

/**
 * Makes the portal's role the active cabinet (users.role is what `authenticate` reads), through the same
 * persona path the cabinet switcher uses, so profiles are provisioned exactly as before.
 * Must only be called after assertPortalAccess.
 */
async function activatePortalRole(userId, portal, req = null) {
  if (portal.id === 'admin') return;
  const { rows } = await db.query(`SELECT role, persona FROM users WHERE id = $1 LIMIT 1`, [userId]);
  const current = rows[0];
  if (current && current.role === portal.storageRole && String(current.persona || '').trim()) return;
  const { applyPersonaSelection } = require('./personaOnboardingService');
  await applyPersonaSelection({
    userId,
    persona: portal.persona,
    profile: {},
    req,
    requireComplete: false,
    merge: true,
  });
}

module.exports = { PORTALS, PortalError, normalizePortal, deniedError, assertPortalAccess, activatePortalRole };
