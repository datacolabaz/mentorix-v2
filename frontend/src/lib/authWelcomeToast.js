import { PERSONAS } from '../../../shared/personas.mjs'

/** Partner purpose is active (auth role may still be student/instructor). */
function isPartnerPersona(user) {
  return String(user?.persona || '').trim() === PERSONAS.PARTNER
}

/** Post-login confirm modal copy — respect active persona, not only auth role. */
export function authLoggedInToastKey(user) {
  if (isPartnerPersona(user)) return 'auth.toasts.loggedInPartner'
  const persona = String(user?.persona || '').trim()
  if (persona === PERSONAS.STUDENT || String(user?.role || '').toLowerCase() === 'student') {
    return 'auth.toasts.loggedInStudent'
  }
  if (persona === PERSONAS.TEACHER || String(user?.role || '').toLowerCase() === 'instructor') {
    return 'auth.toasts.loggedInTeacher'
  }
  if (persona === PERSONAS.PARENT || String(user?.role || '').toLowerCase() === 'parent') {
    return 'auth.toasts.loggedInParent'
  }
  return 'auth.toasts.loggedIn'
}

export function authLoginErrorMessage(err, t) {
  const code = String(err?.code || '').trim()
  if (code === 'GOOGLE_LOGIN_REQUIRED') {
    return t('auth.toasts.googleLoginRequired')
  }
  if (code === 'ACCOUNT_ALREADY_EXISTS') {
    return t('auth.errors.googleAccountExists')
  }
  const raw = String(err?.message || '')
  if (/duplicate key|violates unique constraint/i.test(raw)) {
    return t('auth.errors.googleAccountExists')
  }
  return err?.message || t('auth.toasts.loginError')
}
