import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { newPendingAdmissionIds, playLiveJoinChime } from './liveJoinChime.js'

describe('newPendingAdmissionIds', () => {
  it('does not notify on the first snapshot', () => {
    const seen = new Set()
    assert.deepEqual(newPendingAdmissionIds(seen, [{ id: 'a' }, { id: 'b' }], false), [])
  })

  it('notifies only newly seen pending rows', () => {
    const seen = new Set(['a'])
    assert.deepEqual(newPendingAdmissionIds(seen, [{ id: 'a' }, { id: 'c' }], true), ['c'])
  })
})

describe('playLiveJoinChime', () => {
  it('starts two oscillator tones', () => {
    const started = []
    const ctx = {
      currentTime: 1,
      destination: {},
      createOscillator() {
        return {
          type: '',
          frequency: { value: 0 },
          connect() {},
          start(t) {
            started.push(t)
          },
          stop() {},
        }
      },
      createGain() {
        return {
          gain: {
            setValueAtTime() {},
            exponentialRampToValueAtTime() {},
          },
          connect() {},
        }
      },
    }
    assert.equal(playLiveJoinChime(() => ctx), true)
    assert.equal(started.length, 2)
  })

  it('returns false when audio is unavailable', () => {
    assert.equal(playLiveJoinChime(() => null), false)
  })
})
