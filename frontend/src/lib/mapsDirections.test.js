import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mapsDirectionsUrls } from './mapsDirections.js'

describe('mapsDirectionsUrls', () => {
  it('builds Google and Waze links', () => {
    const urls = mapsDirectionsUrls(40.377, 49.8519)
    assert.ok(urls.google.includes('google.com/maps/dir'))
    assert.ok(urls.google.includes('40.377'))
    assert.ok(urls.waze.includes('waze.com'))
    assert.ok(urls.waze.includes('40.377'))
  })

  it('returns null for invalid coords', () => {
    assert.equal(mapsDirectionsUrls(null, 49), null)
  })
})
