import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getGoogleMapsApiKey, isGoogleMapsConfigured } from './googleMapsLoader.js'

describe('googleMapsLoader', () => {
  it('treats empty key as not configured', () => {
    assert.equal(getGoogleMapsApiKey(), null)
    assert.equal(isGoogleMapsConfigured(), false)
  })
})
