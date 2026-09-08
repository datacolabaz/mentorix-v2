import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { loginWithEmailPassword } from './emailLogin.js'

describe('loginWithEmailPassword', () => {
  it('sends email and password without forcing a teacher role', async () => {
    const calls = []
    const apiPost = async (path, body) => {
      calls.push({ path, body })
      return { token: 't', user: { role: 'student' } }
    }
    const data = await loginWithEmailPassword(apiPost, 'a@b.com', 'secret')
    assert.equal(calls.length, 1)
    assert.equal(calls[0].path, '/auth/login/email')
    assert.deepEqual(calls[0].body, { email: 'a@b.com', password: 'secret' })
    assert.equal(data.user.role, 'student')
  })

  it('passes a role hint only when the user picked one', async () => {
    const calls = []
    const apiPost = async (path, body) => {
      calls.push({ path, body })
      return { ok: true }
    }
    await loginWithEmailPassword(apiPost, 'a@b.com', 'secret', 'student')
    assert.deepEqual(calls[0].body, { email: 'a@b.com', password: 'secret', role: 'student' })
  })
})
