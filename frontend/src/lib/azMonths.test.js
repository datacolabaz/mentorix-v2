import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { formatNamedDate, formatYmMonthShort, MONTHS_SHORT, monthShort } from './azMonths.js'

describe('azMonths', () => {
  it('labels YYYY-MM with Azerbaijani short names, never MO/M01/Mon', () => {
    assert.equal(formatYmMonthShort('2026-01', 'az'), 'yan')
    assert.equal(formatYmMonthShort('2026-09', 'az'), 'sen')
    assert.equal(formatYmMonthShort('2026-12', 'az'), 'dek')
    for (let m = 1; m <= 12; m++) {
      const ym = `2026-${String(m).padStart(2, '0')}`
      const label = formatYmMonthShort(ym, 'az')
      assert.equal(label, MONTHS_SHORT.az[m - 1])
      assert.doesNotMatch(label, /^M0/i)
      assert.notEqual(label.toUpperCase(), 'MO')
      assert.notEqual(label, 'Mon')
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
})
