export const RETURN_AFTER_LOGIN_KEY = 'mx_return_after_login'

const BLOCKED_RETURN_PATHS = new Set(['/login', '/register', '/verify-phone', '/onboarding'])

export function isSafeAppPath(path) {
  const ret = String(path || '').trim()
  return Boolean(ret.startsWith('/') && !ret.startsWith('//') && !BLOCKED_RETURN_PATHS.has(ret))
}

/** WhatsApp/QR dəvət: qeydiyyatdan sonra panelə yox, dəvət səhifəsinə qayıt. */
export function isInviteResumePath(path) {
  return /^\/(join|exam|task|library)(\/|$)/.test(String(path || '').split(/[?#]/)[0])
}

export function peekReturnAfterLogin() {
  try {
    const sessionVal = String(sessionStorage.getItem(RETURN_AFTER_LOGIN_KEY) || '').trim()
    const localVal = String(localStorage.getItem(RETURN_AFTER_LOGIN_KEY) || '').trim()
    const ret = isSafeAppPath(sessionVal) ? sessionVal : isSafeAppPath(localVal) ? localVal : ''
    return ret
  } catch {
    return ''
  }
}

export function rememberReturnAfterLogin(path) {
  const ret = String(path || '').trim()
  if (!isSafeAppPath(ret)) return
  try {
    sessionStorage.setItem(RETURN_AFTER_LOGIN_KEY, ret)
    localStorage.setItem(RETURN_AFTER_LOGIN_KEY, ret)
  } catch {
    /* ignore */
  }
}

export function consumeReturnAfterLogin() {
  const ret = peekReturnAfterLogin()
  try {
    sessionStorage.removeItem(RETURN_AFTER_LOGIN_KEY)
    localStorage.removeItem(RETURN_AFTER_LOGIN_KEY)
  } catch {
    /* ignore */
  }
  return ret
}
