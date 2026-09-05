import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { liveGridCountAttr, liveTileKey, splitLiveConferenceTracks } from './liveGrid.js'

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

describe('splitLiveConferenceTracks', () => {
  const teacherCam = { participant: { identity: 'teacher-1' }, source: 'camera' }
  const teacherShare = { participant: { identity: 'teacher-1' }, source: 'screen_share' }
  const studentCam = { participant: { identity: 'student-2' }, source: 'camera' }

  it('keeps every camera tile when nobody is sharing', () => {
    const split = splitLiveConferenceTracks([teacherCam, studentCam])
    assert.equal(split.hasScreenShare, false)
    assert.equal(split.screenTracks.length, 0)
    assert.deepEqual(split.galleryTracks, [teacherCam, studentCam])
  })

  it('drops the presenter’s camera so the share replaces their window', () => {
    const split = splitLiveConferenceTracks([teacherCam, teacherShare, studentCam])
    assert.equal(split.hasScreenShare, true)
    assert.deepEqual(split.screenTracks, [teacherShare])
    assert.deepEqual(split.galleryTracks, [studentCam])
    assert.deepEqual(split.presentingIdentities, ['teacher-1'])
  })

  it('hides a student presenter’s profile the same way', () => {
    const studentShare = { participant: { identity: 'student-2' }, source: 'screen_share' }
    const split = splitLiveConferenceTracks([teacherCam, studentCam, studentShare])
    assert.deepEqual(split.galleryTracks, [teacherCam])
    assert.deepEqual(split.screenTracks, [studentShare])
  })
})
