import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { formatNamedDate, formatNumericDateTime, formatYmMonthShort, MONTHS_SHORT, monthShort } from './azMonths.js'

describe('azMonths', () => {
  it('labels YYYY-MM with Azerbaijani short names, never MO1/M01/Mon', () => {
    assert.equal(formatYmMonthShort('2026-01', 'az'), 'yan')
    assert.equal(formatYmMonthShort('2026-09', 'az'), 'sen')
    assert.equal(formatYmMonthShort('2026-12', 'az'), 'dek')
    for (let m = 1; m <= 12; m++) {
      const ym = `2026-${String(m).padStart(2, '0')}`
      const label = formatYmMonthShort(ym, 'az')
      assert.equal(label, MONTHS_SHORT.az[m - 1])
      assert.doesNotMatch(label, /^M0/i)
      assert.doesNotMatch(label, /^MO\d/i)
      assert.notEqual(label.toUpperCase(), 'MO')
      assert.notEqual(label, 'Mon')
      assert.notEqual(label, `M${String(m).padStart(2, '0')}`)
      assert.notEqual(label, `MO${m}`)
    }
  })

  it('uses English and Russian short names when UI language is not az', () => {
    assert.equal(formatYmMonthShort('2026-09', 'en'), 'Sep')
    assert.equal(formatYmMonthShort('2026-09', 'ru'), 'сен')
  })

  it('formats certificate-style dates with named months', () => {
    const s = formatNamedDate('2026-07-04T00:00:00.000Z', 'az', {
      month: 'long',
      padDay: true,
      timeZone: 'UTC',
    })
    assert.equal(s, '04 iyul 2026')
    assert.equal(monthShort(6, 'az'), 'iyl')
  })

  it('formats numeric datetimes without locale month names', () => {
    const s = formatNumericDateTime('2026-01-15T12:00:00.000Z', { timeZone: 'UTC' })
    assert.equal(s, '15.01.2026, 12:00')
    assert.doesNotMatch(s, /M01|MO1|Jan/i)
  })
})
