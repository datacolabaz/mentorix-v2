import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isInviteResumePath, isSafeAppPath, isAllowedReturnPathForUser } from './inviteReturn.js'
import {
  pathForPendingStudentDeepLink,
  rememberPendingStudentDeepLink,
} from './pendingStudentDeepLink.js'
import { PERSONAS, isPersonaId, DEFAULT_APP_PATH } from '../../../shared/personas.mjs'

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

describe('isAllowedReturnPathForUser', () => {
  it('allows partner dashboard for any role; admin paths only for admin', () => {
    assert.equal(isAllowedReturnPathForUser({ role: 'instructor' }, '/partner/dashboard'), true)
    assert.equal(isAllowedReturnPathForUser({ role: 'course' }, '/admin/partners'), false)
    assert.equal(isAllowedReturnPathForUser({ role: 'admin' }, '/admin/partners'), true)
    assert.equal(isAllowedReturnPathForUser({ role: 'admin' }, '/admin/partners?tab=1'), true)
  })
})

/** Mirrors frontend/src/lib/postAuth.js partner-primary routing contract. */
const ROLE_HOME = {
  admin: '/admin',
  instructor: '/instructor',
  student: '/student',
  parent: '/parent',
  course: '/org',
}

function dashboardPathForRole(role) {
  return ROLE_HOME[role] || DEFAULT_APP_PATH
}

function isPartnerPersona(user) {
  return String(user?.persona || '').trim() === PERSONAS.PARTNER
}

function dashboardPathForUser(user) {
  if (!user) return '/login'
  if (String(user.role || '').toLowerCase() === 'admin') return '/admin'
  if (isPartnerPersona(user)) return '/partner/dashboard'
  if (isPersonaId(user.persona)) return dashboardPathForRole(user.role)
  return DEFAULT_APP_PATH
}

function secondaryPanelPathForUser(user) {
  if (!user) return '/login'
  if (String(user.role || '').toLowerCase() === 'admin') return '/admin'
  return dashboardPathForRole(user.role)
}

function isRoleHomePath(pathname) {
  const p = String(pathname || '').split(/[?#]/)[0].replace(/\/+$/, '') || '/'
  return p === '/student' || p === '/instructor' || p === '/parent' || p === '/org' || p === '/app'
}

function resolvePostAuthPath(user, { stored = '' } = {}) {
  const ret = stored
  if (isInviteResumePath(ret)) return ret
  if (isPartnerPersona(user)) {
    const retPath = String(ret || '').split(/[?#]/)[0]
    if (retPath.startsWith('/partner') && isAllowedReturnPathForUser(user, ret)) return ret
    return dashboardPathForUser(user)
  }
  if (ret) {
    if (!isAllowedReturnPathForUser(user, ret)) return dashboardPathForUser(user)
    return ret
  }
  return dashboardPathForUser(user)
}

describe('partner persona primary home', () => {
  it('routes partner persona to partner cabinet regardless of auth role', () => {
    assert.equal(dashboardPathForUser({ role: 'student', persona: 'partner' }), '/partner/dashboard')
    assert.equal(dashboardPathForUser({ role: 'instructor', persona: 'partner' }), '/partner/dashboard')
    assert.equal(secondaryPanelPathForUser({ role: 'student', persona: 'partner' }), '/student')
    assert.equal(secondaryPanelPathForUser({ role: 'instructor', persona: 'partner' }), '/instructor')
  })

  it('ignores stale role-panel return paths for partner persona', () => {
    assert.equal(
      resolvePostAuthPath({ role: 'student', persona: 'partner', onboarding_completed: true }, { stored: '/student' }),
      '/partner/dashboard',
    )
    assert.equal(
      resolvePostAuthPath(
        { role: 'student', persona: 'partner', onboarding_completed: true },
        { stored: '/partner/dashboard' },
      ),
      '/partner/dashboard',
    )
    assert.equal(
      resolvePostAuthPath({ role: 'student', persona: 'partner', onboarding_completed: true }, { stored: '/join/ABC' }),
      '/join/ABC',
    )
  })

  it('keeps teacher/student persona on role homes', () => {
    assert.equal(dashboardPathForUser({ role: 'instructor', persona: 'teacher' }), '/instructor')
    assert.equal(dashboardPathForUser({ role: 'student', persona: 'student' }), '/student')
  })

  it('never opens student shell from placeholder role without persona', () => {
    assert.equal(dashboardPathForUser({ role: 'student', persona: null }), DEFAULT_APP_PATH)
    assert.equal(
      dashboardPathForUser({ role: 'student', onboarding_completed: true, persona: null }),
      DEFAULT_APP_PATH,
    )
  })

  it('flags role-home paths for partner redirect', () => {
    assert.equal(isRoleHomePath('/student'), true)
    assert.equal(isRoleHomePath('/student/exams'), false)
    assert.equal(isPartnerPersona({ persona: 'partner' }) && isRoleHomePath('/student'), true)
    assert.equal(isPartnerPersona({ persona: 'student' }) && isRoleHomePath('/student'), false)
  })
})
