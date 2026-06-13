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

/** Lazy OTP: girişdə yox, ciddi əməliyyat API 403 → PhoneVerificationGate modal. */
export function userNeedsPhoneVerificationPage(_user) {
  return false
}

export function postAuthNavigate(user, navigate) {
  if (!user?.role) {
    navigate('/onboarding/role', { replace: true })
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
