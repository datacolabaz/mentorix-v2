import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { bakuDateTimeLocalToIso } from './azDatetime.js'

describe('bakuDateTimeLocalToIso', () => {
  it('treats datetime-local as Baku (UTC+4)', () => {
    assert.equal(bakuDateTimeLocalToIso('2026-09-06T15:00'), '2026-09-06T11:00:00.000Z')
  })

  it('returns null for empty input', () => {
    assert.equal(bakuDateTimeLocalToIso(''), null)
  })
})
