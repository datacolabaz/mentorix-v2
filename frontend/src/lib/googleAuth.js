import api, { AUTH_REQUEST_TIMEOUT_MS } from './api'
import i18n from '../i18n'

const LOGIN_ROLE_TRY_ORDER = ['instructor', 'course', 'student', 'parent']

export const ACCOUNT_LINK_EVENT = 'mx:account-link-required'

/**
 * Server Google `sub`-ı tapmadı, amma eyni email ilə köhnə hesab var.
 * AccountLinkHost təsdiq pəncərəsini göstərir; istifadəçi təsdiqləsə sessiya ilə davam edirik.
 */
function requestAccountLink(offer) {
  return new Promise((resolve, reject) => {
    window.dispatchEvent(new CustomEvent(ACCOUNT_LINK_EVENT, { detail: { offer, resolve, reject } }))
  })
}

async function resolveLink(r) {
  return r?.needs_account_link ? requestAccountLink(r) : r
}

/** Mövcud Google hesabı — rol soruşmadan daxil olur; yalnız uğursuzluqda rol cəhdi. */
export async function googleAuthWithAutoRole(credential, forcedRole) {
  if (!forcedRole) {
    try {
      let r = await resolveLink(await api.post('/auth/google/login', { credential, intent: 'signin' }))
      if (r?.token && r?.user) return r
      if (r?.needs_onboarding || r?.needs_role) {
        r = await resolveLink(await api.post('/auth/google/complete', { credential, intent: 'signin' }))
        if (r?.token && r?.user) return r
      }
    } catch (err) {
      if (err?.status === 401 || err?.status === 409 || err?.code === 'EMAIL_NOT_VERIFIED' || err?.code === 'ACCOUNT_LINK_DECLINED') {
        throw err
      }
    }
  }

  const roles = forcedRole ? [forcedRole] : LOGIN_ROLE_TRY_ORDER
  let lastRoleError = null
  for (const role of roles) {
    try {
      let r = await resolveLink(await api.post('/auth/google/login', { credential, role, intent: 'signin' }))
      if (r?.needs_role || r?.needs_onboarding) {
        r = await resolveLink(await api.post('/auth/google/complete', { credential, role, intent: 'signin' }))
      }
      if (r?.token && r?.user) return r
      lastRoleError = new Error(r?.message || i18n.t('auth.errors.googleIncomplete'))
    } catch (err) {
      const status = err?.status
      if (status === 401 || err?.code === 'EMAIL_NOT_VERIFIED' || err?.code === 'ACCOUNT_LINK_DECLINED') throw err
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
  return resolveLink(
    await api.post('/auth/google/complete', { credential, intent: 'signup' }, { timeout: AUTH_REQUEST_TIMEOUT_MS }),
  )
}
