import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  FEATURE_FLAGS,
  FEATURE_FLAG_DEFAULTS,
  featureForPath,
  isPathEnabled,
  filterNavSectionsByFlags,
} from './featureFlagPaths.js'

describe('featureForPath', () => {
  it('maps disabled module routes to their flag', () => {
    assert.equal(featureForPath('/student/universities'), FEATURE_FLAGS.UNIVERSITY_SEARCH)
    assert.equal(featureForPath('/instructor/inquiries?x=1'), FEATURE_FLAGS.MARKETPLACE)
    assert.equal(featureForPath('/mentorship/goals'), FEATURE_FLAGS.MENTOR_SERVICES)
    assert.equal(featureForPath('/live/join/abc'), FEATURE_FLAGS.LIVE_ROOM)
  })

  it('does not match unrelated routes that share a prefix', () => {
    assert.equal(featureForPath('/searching'), null)
    assert.equal(featureForPath('/instructor/exams'), null)
    assert.equal(featureForPath('/instructor/live/history'), null)
  })
})

describe('filterNavSectionsByFlags', () => {
  const sections = [
    { id: 'a', items: [{ to: '/instructor/exams' }, { to: '/instructor/inquiries' }] },
    { id: 'b', items: [{ to: '/instructor/university-programs' }] },
  ]

  it('drops disabled links and empty sections with default flags', () => {
    const out = filterNavSectionsByFlags(sections, FEATURE_FLAG_DEFAULTS)
    assert.deepEqual(out, [{ id: 'a', items: [{ to: '/instructor/exams' }] }])
  })

  it('keeps links when the flag is on', () => {
    const flags = { ...FEATURE_FLAG_DEFAULTS, [FEATURE_FLAGS.MARKETPLACE]: true }
    assert.equal(isPathEnabled('/instructor/inquiries', flags), true)
    assert.equal(filterNavSectionsByFlags(sections, flags)[0].items.length, 2)
  })
})
