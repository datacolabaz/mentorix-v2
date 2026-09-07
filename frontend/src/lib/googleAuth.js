import api, { AUTH_REQUEST_TIMEOUT_MS } from './api'
import i18n from '../i18n'

const LOGIN_ROLE_TRY_ORDER = ['instructor', 'course', 'student', 'parent']

/** Mövcud Google hesabı — rol soruşmadan daxil olur; yalnız uğursuzluqda rol cəhdi. */
export async function googleAuthWithAutoRole(credential, forcedRole) {
  if (!forcedRole) {
    try {
      let r = await api.post('/auth/google/login', { credential, intent: 'signin' })
      if (r?.token && r?.user) return r
      if (r?.needs_onboarding || r?.needs_role) {
        r = await api.post('/auth/google/complete', { credential, intent: 'signin' })
        if (r?.token && r?.user) return r
      }
    } catch (err) {
      if (err?.status === 401 || err?.status === 409) throw err
    }
  }

  const roles = forcedRole ? [forcedRole] : LOGIN_ROLE_TRY_ORDER
  let lastRoleError = null
  for (const role of roles) {
    try {
      let r = await api.post('/auth/google/login', { credential, role, intent: 'signin' })
      if (r?.needs_role || r?.needs_onboarding || r?.needs_phone_link) {
        r = await api.post('/auth/google/complete', { credential, role, intent: 'signin' })
      }
      if (r?.token && r?.user) return r
      lastRoleError = new Error(r?.message || i18n.t('auth.errors.googleIncomplete'))
    } catch (err) {
      const status = err?.status
      if (status === 401) throw err
      if (status === 403) {
        lastRoleError = err
        continue
      }
      throw err
    }
  }
  throw lastRoleError || new Error(i18n.t('auth.errors.googleSelectRole'))
}

export async function googleSignup(credential) {
  return api.post(
    '/auth/google/complete',
    { credential, intent: 'signup' },
    { timeout: AUTH_REQUEST_TIMEOUT_MS },
  )
}
