import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { liveGridCountAttr, liveTileKey } from './liveGrid.js'

describe('liveGridCountAttr', () => {
  it('uses one cell for a single participant', () => {
    assert.equal(liveGridCountAttr(1), '1')
  })

  it('keeps two equal columns for two tiles', () => {
    assert.equal(liveGridCountAttr(2), '2')
  })

  it('uses a 2x2 bucket for three or four tiles', () => {
    assert.equal(liveGridCountAttr(3), '4')
    assert.equal(liveGridCountAttr(4), '4')
  })
})

describe('liveTileKey', () => {
  it('combines participant and source', () => {
    assert.equal(liveTileKey({ participant: { sid: 'abc' }, source: 'camera' }), 'abc:camera')
  })
})
