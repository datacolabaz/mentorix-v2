import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { formatCoordPair, parseMapCoords } from './parseMapCoords.js'

describe('parseMapCoords', () => {
  it('reads a Waze dropped-pin pair', () => {
    assert.deepEqual(parseMapCoords('40.4028, 49.8715'), { lat: '40.4028', lng: '49.8715' })
  })

  it('reads a Waze navigate URL', () => {
    const parsed = parseMapCoords('https://waze.com/ul?ll=40.4028,49.8715&navigate=yes')
    assert.deepEqual(parsed, { lat: '40.4028', lng: '49.8715' })
  })

  it('reads a Waze live-map link', () => {
    const parsed = parseMapCoords('https://www.waze.com/live-map/directions?to=ll.40.4028%2C49.8715')
    assert.deepEqual(parsed, { lat: '40.4028', lng: '49.8715' })
  })

  it('reads a Google Maps @ URL', () => {
    const parsed = parseMapCoords('https://www.google.com/maps/@40.4028,49.8715,17z')
    assert.deepEqual(parsed, { lat: '40.4028', lng: '49.8715' })
  })

  it('rejects empty and out-of-range values', () => {
    assert.equal(parseMapCoords(''), null)
    assert.equal(parseMapCoords('99.1, 49.8'), null)
  })
})

describe('formatCoordPair', () => {
  it('joins saved lat/lng', () => {
    assert.equal(formatCoordPair('40.4028', '49.8715'), '40.4028, 49.8715')
    assert.equal(formatCoordPair('', ''), '')
  })
})
