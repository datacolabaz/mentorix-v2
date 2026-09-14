import { DEFAULT_APP_PATH, ONBOARDING_PATH, PERSONAS, isPersonaId, userNeedsOnboarding } from '../constants/personas'
import {
  consumeReturnAfterLogin,
  isAllowedReturnPathForUser,
  isInviteResumePath,
  peekReturnAfterLogin,
} from './inviteReturn'
import {
  pathForPendingStudentDeepLink,
  peekPendingStudentDeepLink,
} from './pendingStudentDeepLink'

export {
  RETURN_AFTER_LOGIN_KEY,
  consumeReturnAfterLogin,
  isInviteResumePath,
  isSafeAppPath,
  isAllowedReturnPathForUser,
  peekReturnAfterLogin,
  rememberReturnAfterLogin,
} from './inviteReturn'

const ROLE_HOME = {
  admin: '/admin',
  instructor: '/instructor',
  student: '/student',
  parent: '/parent',
  course: '/org',
}

export function dashboardPathForRole(role) {
  return ROLE_HOME[role] || DEFAULT_APP_PATH
}

/** Partner purpose is active (auth role may still be student/instructor). */
export function isPartnerPersona(user) {
  return String(user?.persona || '').trim() === PERSONAS.PARTNER
}

/** Secondary role panel (exams/invite shell) — ignores partner purpose overlay. */
export function secondaryPanelPathForUser(user) {
  if (!user) return '/login'
  if (String(user.role || '').toLowerCase() === 'admin') return '/admin'
  return dashboardPathForRole(user.role)
}

/** Role-home index paths that should yield to Partner cabinet when persona=partner. */
export function isRoleHomePath(pathname) {
  const p = String(pathname || '').split(/[?#]/)[0].replace(/\/+$/, '') || '/'
  return p === '/student' || p === '/instructor' || p === '/parent' || p === '/org' || p === '/app'
}

const ROLE_PANEL_OVERRIDE_KEY = 'mx_role_panel_override'

/** Allow one visit to the auth-role panel while partner purpose stays active. */
export function allowRolePanelVisit() {
  try {
    sessionStorage.setItem(ROLE_PANEL_OVERRIDE_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function peekRolePanelOverride() {
  try {
    return Boolean(sessionStorage.getItem(ROLE_PANEL_OVERRIDE_KEY))
  } catch {
    return false
  }
}

export function consumeRolePanelOverride() {
  try {
    const v = sessionStorage.getItem(ROLE_PANEL_OVERRIDE_KEY)
    if (!v) return false
    sessionStorage.removeItem(ROLE_PANEL_OVERRIDE_KEY)
    return true
  } catch {
    return false
  }
}

/** True when partner users should leave the role-home index for Partner cabinet. */
export function shouldRedirectPartnerToCabinet(user, pathname, { allowOverride = true } = {}) {
  if (!isPartnerPersona(user) || !isRoleHomePath(pathname)) return false
  if (allowOverride && peekRolePanelOverride()) return false
  return true
}

/** Persona yoxdursa xüsusi role panelinə məcburi getmə — ümumi /app. */
export function dashboardPathForUser(user) {
  if (!user) return '/login'
  if (String(user.role || '').toLowerCase() === 'admin') return '/admin'
  if (isPartnerPersona(user)) return '/partner/dashboard'
  // Placeholder role=student must not open /student until persona is chosen.
  if (isPersonaId(user.persona)) return dashboardPathForRole(user.role)
  return DEFAULT_APP_PATH
}

export { userNeedsOnboarding, ONBOARDING_PATH, DEFAULT_APP_PATH }

export function resolvePostAuthPath(user, { nextQuery = '', stored = peekReturnAfterLogin() } = {}) {
  const q = String(nextQuery || '').trim()
  const fromQuery = q.startsWith('/') && !q.startsWith('//') ? q : ''
  const ret = fromQuery && fromQuery !== '/login' && fromQuery !== '/register' ? fromQuery : stored
  if (isInviteResumePath(ret)) return ret
  if (userNeedsOnboarding(user)) return ONBOARDING_PATH
  const pendingPath = pathForPendingStudentDeepLink(peekPendingStudentDeepLink())
  if (pendingPath) return pendingPath
  // Partner purpose owns primary home; do not resume stale role-panel returns.
  if (isPartnerPersona(user)) {
    const retPath = String(ret || '').split(/[?#]/)[0]
    if (retPath.startsWith('/partner') && isAllowedReturnPathForUser(user, ret)) return ret
    return dashboardPathForUser(user)
  }
  if (ret && ret !== ONBOARDING_PATH) {
    if (!isAllowedReturnPathForUser(user, ret)) return dashboardPathForUser(user)
    return ret
  }
  return dashboardPathForUser(user)
}

/** Lazy OTP: girişdə yox, ciddi əməliyyat API 403 → PhoneVerificationGate modal. */
export function userNeedsPhoneVerificationPage(_user) {
  return false
}

export function postAuthNavigate(user, navigate, nextQuery) {
  const stored = peekReturnAfterLogin()
  const path = resolvePostAuthPath(user, { nextQuery, stored })
  // Onboarding saxlanılan invite return-u saxlamaq üçündür; digər hallarda sticky next təmizlənsin.
  if (path !== ONBOARDING_PATH) consumeReturnAfterLogin()
  navigate(path, { replace: true })
}
