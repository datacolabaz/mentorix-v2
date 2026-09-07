import { DEFAULT_APP_PATH, ONBOARDING_PATH, isPersonaId, userNeedsOnboarding } from '../constants/personas'

const ROLE_HOME = {
  admin: '/admin',
  instructor: '/instructor',
  student: '/student',
  parent: '/parent',
  course: '/course',
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

/** Lazy OTP: girişdə yox, ciddi əməliyyat API 403 → PhoneVerificationGate modal. */
export function userNeedsPhoneVerificationPage(_user) {
  return false
}

export function postAuthNavigate(user, navigate) {
  if (userNeedsOnboarding(user)) {
    navigate(ONBOARDING_PATH, { replace: true })
    return
  }
  try {
    const ret = sessionStorage.getItem('mx_return_after_login')
    if (ret && ret.startsWith('/') && ret !== '/login' && ret !== '/register' && ret !== '/verify-phone' && ret !== ONBOARDING_PATH) {
      sessionStorage.removeItem('mx_return_after_login')
      navigate(ret, { replace: true })
      return
    }
  } catch {
    /* ignore */
  }
  navigate(dashboardPathForUser(user), { replace: true })
}
