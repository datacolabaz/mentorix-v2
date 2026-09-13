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

  it('uses student toast for student persona/role', () => {
    assert.equal(authLoggedInToastKey({ role: 'student', persona: 'student' }), 'auth.toasts.loggedInStudent')
    assert.equal(authLoggedInToastKey({ role: 'student' }), 'auth.toasts.loggedInStudent')
  })

  it('uses teacher toast for instructor', () => {
    assert.equal(
      authLoggedInToastKey({ role: 'instructor', persona: 'teacher' }),
      'auth.toasts.loggedInTeacher',
    )
  })
})

describe('authLoginErrorMessage', () => {
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
