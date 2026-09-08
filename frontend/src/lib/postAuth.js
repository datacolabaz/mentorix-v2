import { DEFAULT_APP_PATH, ONBOARDING_PATH, isPersonaId, userNeedsOnboarding } from '../constants/personas'
import {
  consumeReturnAfterLogin,
  isInviteResumePath,
  peekReturnAfterLogin,
} from './inviteReturn'

export {
  RETURN_AFTER_LOGIN_KEY,
  consumeReturnAfterLogin,
  isInviteResumePath,
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

/** Persona yoxdursa xüsusi role panelinə məcburi getmə — ümumi /app. */
export function dashboardPathForUser(user) {
  if (!user) return '/login'
  if (String(user.role || '').toLowerCase() === 'admin') return '/admin'
  if (isPersonaId(user.persona)) return dashboardPathForRole(user.role)
  if (user.onboarding_completed) return DEFAULT_APP_PATH
  return dashboardPathForRole(user.role)
}

export { userNeedsOnboarding, ONBOARDING_PATH, DEFAULT_APP_PATH }

export function resolvePostAuthPath(user, { nextQuery = '', stored = peekReturnAfterLogin() } = {}) {
  const q = String(nextQuery || '').trim()
  const fromQuery = q.startsWith('/') && !q.startsWith('//') ? q : ''
  const ret = fromQuery && fromQuery !== '/login' && fromQuery !== '/register' ? fromQuery : stored
  if (isInviteResumePath(ret)) return ret
  if (userNeedsOnboarding(user)) return ONBOARDING_PATH
  if (ret && ret !== ONBOARDING_PATH) return ret
  return dashboardPathForUser(user)
}

/** Lazy OTP: girişdə yox, ciddi əməliyyat API 403 → PhoneVerificationGate modal. */
export function userNeedsPhoneVerificationPage(_user) {
  return false
}

export function postAuthNavigate(user, navigate, nextQuery) {
  const stored = peekReturnAfterLogin()
  const path = resolvePostAuthPath(user, { nextQuery, stored })
  if (path !== ONBOARDING_PATH && path === stored) consumeReturnAfterLogin()
  navigate(path, { replace: true })
}
