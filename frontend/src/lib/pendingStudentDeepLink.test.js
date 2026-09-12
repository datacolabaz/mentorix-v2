import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  rememberPendingStudentDeepLink,
  peekPendingStudentDeepLink,
  consumePendingStudentDeepLink,
  pathForPendingStudentDeepLink,
  PENDING_STUDENT_DEEP_LINK_KEY,
} from './pendingStudentDeepLink.js'

const memory = new Map()

function installStorage() {
  const api = {
    getItem: (k) => (memory.has(k) ? memory.get(k) : null),
    setItem: (k, v) => {
      memory.set(k, String(v))
    },
    removeItem: (k) => {
      memory.delete(k)
    },
  }
  globalThis.sessionStorage = api
  globalThis.localStorage = api
}

describe('pendingStudentDeepLink', () => {
  beforeEach(() => {
    memory.clear()
    installStorage()
  })

  it('remembers and resolves task open path', () => {
    rememberPendingStudentDeepLink({ kind: 'task', openId: 'sa-1', taskId: 'task-9' })
    assert.deepEqual(peekPendingStudentDeepLink(), {
      kind: 'task',
      openId: 'sa-1',
      taskId: 'task-9',
    })
    assert.equal(
      pathForPendingStudentDeepLink(),
      '/student/assignments?open=sa-1',
    )
    assert.deepEqual(consumePendingStudentDeepLink()?.openId, 'sa-1')
    assert.equal(peekPendingStudentDeepLink(), null)
    assert.equal(memory.has(PENDING_STUDENT_DEEP_LINK_KEY), false)
  })

  it('falls back to task id and exam paths', () => {
    rememberPendingStudentDeepLink({ kind: 'task', taskId: 'task-9' })
    assert.equal(pathForPendingStudentDeepLink(), '/student/assignments?task=task-9')
    rememberPendingStudentDeepLink({ kind: 'exam', examId: 'exam-3' })
    assert.equal(pathForPendingStudentDeepLink(), '/student/exams?exam=exam-3')
  })
})
