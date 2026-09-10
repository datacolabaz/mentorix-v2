import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { COMPACT_PUBLIC_NAV_MQ, isCompactPublicNav } from './compactPublicNav.js'

describe('isCompactPublicNav', () => {
  it('uses the lg breakpoint so phones and tablets keep the thumb-zone menu', () => {
    assert.equal(COMPACT_PUBLIC_NAV_MQ, '(max-width: 1023px)')
  })

  it('is compact when the viewport is at most 1023px', () => {
    const win = {
      matchMedia: (q) => ({ matches: q === '(max-width: 1023px)' }),
    }
    assert.equal(isCompactPublicNav(COMPACT_PUBLIC_NAV_MQ, win), true)
  })

  it('is not compact on desktop widths', () => {
    const win = {
      matchMedia: () => ({ matches: false }),
    }
    assert.equal(isCompactPublicNav(COMPACT_PUBLIC_NAV_MQ, win), false)
  })
})
