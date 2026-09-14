import { PERSONAS } from '../../../shared/personas.mjs'

/** Partner purpose is active (auth role may still be student/instructor). */
function isPartnerPersona(user) {
  return String(user?.persona || '').trim() === PERSONAS.PARTNER
}

/**
 * Post-login confirm modal copy — respect active persona, not placeholder auth role.
 * Signup/Google create store role='student' before purpose is chosen; that must not
 * show "Tələbə kimi daxil oldunuz".
 */
export function authLoggedInToastKey(user) {
  if (isPartnerPersona(user)) return 'auth.toasts.loggedInPartner'
  const persona = String(user?.persona || '').trim()
  if (persona === PERSONAS.STUDENT) return 'auth.toasts.loggedInStudent'
  if (persona === PERSONAS.TEACHER || persona === PERSONAS.HR_COMPANY || persona === PERSONAS.OTHER) {
    return 'auth.toasts.loggedInTeacher'
  }
  if (persona === PERSONAS.PARENT) return 'auth.toasts.loggedInParent'
  if (persona === PERSONAS.EDUCATION_CENTER) return 'auth.toasts.loggedIn'

  // No persona yet (or unknown): never infer from placeholder role.
  if (!persona) return 'auth.toasts.loggedIn'

  const role = String(user?.role || '').toLowerCase()
  if (role === 'instructor') return 'auth.toasts.loggedInTeacher'
  if (role === 'parent') return 'auth.toasts.loggedInParent'
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
