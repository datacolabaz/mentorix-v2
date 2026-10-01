import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isValidAdminIdentifier } from './adminLoginIdentifier.js'

describe('isValidAdminIdentifier', () => {
  it('accepts emails, including ones with many digits', () => {
    for (const v of ['admin@edupanel.co', ' Admin@Example.az ', 'ali123456789@gmail.com']) {
      assert.equal(isValidAdminIdentifier(v), true, v)
    }
  })

  it('accepts phone numbers with 9+ digits in common formats', () => {
    for (const v of [
      '+994 50 123 45 67',
      '994501234567',
      '(050) 123-45-67',
      '050 123 45 67',
      '+994-50-123-45-67',
      '00994 50 123 45 67',
      '501234567',
    ]) {
      assert.equal(isValidAdminIdentifier(v), true, v)
    }
  })

  it('rejects empty, malformed emails, short or mixed phone input', () => {
    for (const v of ['', '   ', 'admin', 'admin@', 'admin@site', '12345678', '+994 abc 123456', '050123456x']) {
      assert.equal(isValidAdminIdentifier(v), false, JSON.stringify(v))
    }
  })
})
