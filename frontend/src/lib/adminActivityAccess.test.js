import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ADMIN_REASON_MIN_LENGTH,
  adminActivityParams,
  clearAdminActivityScope,
  engagementBasePath,
  isAdminActivityMode,
  isAdminReasonError,
  isValidAdminReason,
  normalizeAdminReason,
  setAdminActivityScope,
} from './adminActivityAccess.js'

const TEACHER = '22222222-2222-4222-8222-222222222222'

test('teacher mode sends no admin params and keeps teacher paths', () => {
  clearAdminActivityScope()
  assert.equal(isAdminActivityMode(), false)
  assert.deepEqual(adminActivityParams(), {})
  assert.equal(engagementBasePath(), '/instructor/engagement')
})

test('admin scope requires a reason of the backend minimum length', () => {
  assert.equal(ADMIN_REASON_MIN_LENGTH, 5)
  assert.equal(isValidAdminReason('   abc  '), false)
  assert.equal(setAdminActivityScope({ instructorId: TEACHER, reason: 'abc' }), false)
  assert.equal(isAdminActivityMode(), false)
  assert.equal(setAdminActivityScope({ instructorId: TEACHER, reason: '  Dəstək   sorğusu #42 ' }), true)
  assert.deepEqual(adminActivityParams(), { instructor_id: TEACHER, reason: 'Dəstək sorğusu #42' })
  assert.equal(engagementBasePath(), `/admin/instructors/${TEACHER}/activity`)
  clearAdminActivityScope()
  assert.deepEqual(adminActivityParams(), {})
})

test('reason normalization and error detection', () => {
  assert.equal(normalizeAdminReason('a \n b'), 'a b')
  assert.equal(normalizeAdminReason('x'.repeat(600)).length, 500)
  assert.equal(isAdminReasonError({ code: 'ADMIN_REASON_REQUIRED' }), true)
  assert.equal(isAdminReasonError({ code: 'ADMIN_TARGET_REQUIRED' }), true)
  assert.equal(isAdminReasonError({ code: 'ADMIN_AUDIT_UNAVAILABLE' }), false)
})
