import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isInviteResumePath, isSafeAppPath } from './inviteReturn.js'
import {
  pathForPendingStudentDeepLink,
  rememberPendingStudentDeepLink,
} from './pendingStudentDeepLink.js'

describe('isInviteResumePath', () => {
  it('matches join/exam/task/library invites', () => {
    assert.equal(isInviteResumePath('/join/ABC123'), true)
    assert.equal(isInviteResumePath('/exam/9'), true)
    assert.equal(isInviteResumePath('/task/3?x=1'), true)
    assert.equal(isInviteResumePath('/library/group-1'), true)
    assert.equal(isInviteResumePath('/student'), false)
    assert.equal(isInviteResumePath('/onboarding'), false)
  })
})

describe('isSafeAppPath', () => {
  it('rejects auth and protocol-relative paths', () => {
    assert.equal(isSafeAppPath('/join/ABC'), true)
    assert.equal(isSafeAppPath('/login'), false)
    assert.equal(isSafeAppPath('//evil.example'), false)
    assert.equal(isSafeAppPath('/onboarding'), false)
  })
})

describe('pending deep link paths', () => {
  const memory = new Map()
  const api = {
    getItem: (k) => (memory.has(k) ? memory.get(k) : null),
    setItem: (k, v) => memory.set(k, String(v)),
    removeItem: (k) => memory.delete(k),
  }

  it('builds assignment open path for post-auth resume', () => {
    memory.clear()
    globalThis.sessionStorage = api
    globalThis.localStorage = api
    rememberPendingStudentDeepLink({ kind: 'task', openId: 'sa-22', taskId: 'task-1' })
    assert.equal(pathForPendingStudentDeepLink(), '/student/assignments?open=sa-22')
  })
})
