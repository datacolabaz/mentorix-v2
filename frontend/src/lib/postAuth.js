const ROLE_HOME = {
  admin: '/admin',
  instructor: '/instructor',
  student: '/student',
  parent: '/parent',
  course: '/course',
}

export function dashboardPathForRole(role) {
  return ROLE_HOME[role] || '/login'
}

/** Google ilə giriş: OTP telefon təsdiqi səhifəsi (müəllim / tələbə). */
export function userNeedsPhoneVerificationPage(user) {
  if (!user) return false
  if (!['instructor', 'student'].includes(user.role)) return false
  if (user.needs_phone_verification === true) return true
  if (user.phone_verified === true) return false
  const hasGoogle = Boolean(String(user.google_id || user.google_sub || '').trim())
  return hasGoogle
}

export function postAuthNavigate(user, navigate) {
  if (!user?.role) {
    navigate('/onboarding/role', { replace: true })
    return
  }
  if (userNeedsPhoneVerificationPage(user)) {
    navigate('/verify-phone', { replace: true })
    return
  }
  try {
    const ret = sessionStorage.getItem('mx_return_after_login')
    if (ret && ret.startsWith('/') && ret !== '/login' && ret !== '/verify-phone') {
      sessionStorage.removeItem('mx_return_after_login')
      navigate(ret, { replace: true })
      return
    }
  } catch {
    /* ignore */
  }
  navigate(dashboardPathForRole(user.role), { replace: true })
}
