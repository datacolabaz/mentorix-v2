import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { formatDateTime, isoDateTime } from './formatDateTime.js'

describe('formatDateTime', () => {
  // 17:34 UTC = 21:34 Asia/Baku (UTC+4)
  const v = '2026-09-29T17:34:00Z'

  it('az: 29.09.2026, 21:34', () => {
    assert.equal(formatDateTime(v, 'az'), '29.09.2026, 21:34')
  })

  it('en: Sep 29, 2026, 21:34', () => {
    assert.equal(formatDateTime(v, 'en'), 'Sep 29, 2026, 21:34')
  })

  it('single-digit day in en is not padded, az is', () => {
    assert.equal(formatDateTime('2026-01-05T06:07:00Z', 'en'), 'Jan 5, 2026, 10:07')
    assert.equal(formatDateTime('2026-01-05T06:07:00Z', 'az'), '05.01.2026, 10:07')
  })

  it('uses Baku time across midnight', () => {
    assert.equal(formatDateTime('2026-12-31T21:30:00Z', 'az'), '01.01.2027, 01:30')
    assert.equal(formatDateTime('2026-12-31T21:30:00Z', 'en'), 'Jan 1, 2027, 01:30')
  })

  it('accepts Date objects and handles empty/invalid input', () => {
    assert.equal(formatDateTime(new Date(v), 'en'), 'Sep 29, 2026, 21:34')
    assert.equal(formatDateTime(null, 'az'), '')
    assert.equal(formatDateTime('not a date', 'en'), '')
  })

  it('unknown/ru locales fall back to the numeric format', () => {
    assert.equal(formatDateTime(v, 'ru'), '29.09.2026, 21:34')
    assert.equal(formatDateTime(v, undefined), '29.09.2026, 21:34')
  })

  it('isoDateTime', () => {
    assert.equal(isoDateTime(v), '2026-09-29T17:34:00.000Z')
    assert.equal(isoDateTime('x'), '')
  })
})
