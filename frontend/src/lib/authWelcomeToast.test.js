import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { authLoggedInToastKey, authLoginErrorMessage } from './authWelcomeToast.js'

describe('authLoggedInToastKey', () => {
  it('prefers partner persona over student auth role', () => {
    assert.equal(
      authLoggedInToastKey({ role: 'student', persona: 'partner' }),
      'auth.toasts.loggedInPartner',
    )
  })

  it('uses student toast only for explicit student persona', () => {
    assert.equal(authLoggedInToastKey({ role: 'student', persona: 'student' }), 'auth.toasts.loggedInStudent')
  })

  it('does not treat placeholder role=student as logged-in student', () => {
    assert.equal(authLoggedInToastKey({ role: 'student' }), 'auth.toasts.loggedIn')
    assert.equal(authLoggedInToastKey({ role: 'student', persona: null }), 'auth.toasts.loggedIn')
    assert.equal(authLoggedInToastKey({ role: null, onboarding_completed: false }), 'auth.toasts.loggedIn')
  })

  it('uses teacher toast for instructor', () => {
    assert.equal(
      authLoggedInToastKey({ role: 'instructor', persona: 'teacher' }),
      'auth.toasts.loggedInTeacher',
    )
  })
})

describe('authLoginErrorMessage', () => {
  it('maps password failures to the active-language message', () => {
    const t = (k) => (k === 'auth.toasts.invalidCredentials' ? 'Incorrect email or password' : k)
    assert.equal(
      authLoginErrorMessage({ code: 'INVALID_CREDENTIALS', message: 'Azərbaycan dilində backend mətni' }, t),
      'Incorrect email or password',
    )
  })

  it('maps GOOGLE_LOGIN_REQUIRED to i18n toast', () => {
    const t = (k) => (k === 'auth.toasts.googleLoginRequired' ? 'Use Google' : k)
    assert.equal(authLoginErrorMessage({ code: 'GOOGLE_LOGIN_REQUIRED' }, t), 'Use Google')
  })

  it('never surfaces raw Postgres unique errors', () => {
    const t = (k) =>
      k === 'auth.errors.googleAccountExists' ? 'Google hesabı mövcuddur' : k
    assert.equal(
      authLoginErrorMessage(
        {
          message: 'duplicate key value violates unique constraint "users_google_sub_unique_not_null"',
        },
        t,
      ),
      'Google hesabı mövcuddur',
    )
    assert.equal(
      authLoginErrorMessage({ code: 'ACCOUNT_ALREADY_EXISTS', message: 'raw' }, t),
      'Google hesabı mövcuddur',
    )
  })
})
