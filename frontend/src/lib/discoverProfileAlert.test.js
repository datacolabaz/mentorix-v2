import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  localizeDiscoverProfileAlert,
  shouldShowDiscoverSubjectsModal,
} from './discoverProfileAlert.js'

const KEYS = {
  'layout.discover.partCategories': 'subjects',
  'layout.discover.partMapPin': 'map pin',
  'layout.discover.partFormats': 'format',
  'layout.discover.focusCategories': 'Add subjects.',
  'layout.discover.focusIncomplete': 'Profile incomplete.',
  'layout.discover.fillInSettings': '{{focus}} Fill {{parts}}.',
  'layout.discover.addSubject': 'Add a subject',
  'layout.discover.completeProfile': 'Complete profile',
}

function t(key, params) {
  let s = KEYS[key] || key
  if (params) {
    s = s.replace('{{focus}}', params.focus || '').replace('{{parts}}', params.parts || '')
  }
  return s
}

describe('localizeDiscoverProfileAlert', () => {
  it('localizes missing categories for English', () => {
    const out = localizeDiscoverProfileAlert(
      { type: 'discover_profile', missing: ['categories'], message: 'AZ fallback', cta: { action: 'OPEN' } },
      t,
      'en',
    )
    assert.match(out.message, /Add subjects/)
    assert.match(out.message, /subjects/)
    assert.equal(out.cta.label, 'Add a subject')
  })

  it('uses complete-profile CTA when subjects exist', () => {
    const out = localizeDiscoverProfileAlert({ missing: ['map_pin'], cta: {} }, t, 'en')
    assert.equal(out.cta.label, 'Complete profile')
    assert.match(out.message, /map pin/)
  })

  it('uses complete-profile CTA when missing is empty', () => {
    const out = localizeDiscoverProfileAlert({ missing: [], cta: {} }, t, 'en')
    assert.equal(out.cta.label, 'Complete profile')
  })

  it('opens subjects modal only when categories are missing', () => {
    assert.equal(shouldShowDiscoverSubjectsModal(null), false)
    assert.equal(shouldShowDiscoverSubjectsModal({ missing: ['categories'] }), true)
    assert.equal(shouldShowDiscoverSubjectsModal({ missing: ['categories', 'map_pin'] }), true)
    assert.equal(shouldShowDiscoverSubjectsModal({ missing: ['map_pin'] }), false)
    assert.equal(shouldShowDiscoverSubjectsModal({ missing: ['delivery_formats'] }), false)
    assert.equal(shouldShowDiscoverSubjectsModal({ missing: [] }), false)
  })
})
