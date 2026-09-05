import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { absolutePublicUrl, liveGuestJoinUrl } from './absolutePublicUrl.js'

describe('absolutePublicUrl', () => {
  it('prefixes the site origin onto a relative join path', () => {
    assert.equal(
      absolutePublicUrl('/live/join/RNbQ5OHdwAuXdDwLAx9pvjWfm_7US5YW', 'https://mentorix.io'),
      'https://mentorix.io/live/join/RNbQ5OHdwAuXdDwLAx9pvjWfm_7US5YW',
    )
  })

  it('leaves an already-absolute https url unchanged', () => {
    assert.equal(
      absolutePublicUrl('https://mentorix.io/live/join/abc', 'https://other.example'),
      'https://mentorix.io/live/join/abc',
    )
  })

  it('returns the relative path only when no origin is available', () => {
    assert.equal(absolutePublicUrl('/live/join/abc', ''), '/live/join/abc')
  })
})

describe('liveGuestJoinUrl', () => {
  it('builds from join_path so a relative API join_url is not copied', () => {
    assert.equal(
      liveGuestJoinUrl(
        { join_url: '/live/join/token', join_path: '/live/join/token', token: 'token' },
        'https://mentorix.io',
      ),
      'https://mentorix.io/live/join/token',
    )
  })

  it('builds from token when path is missing', () => {
    assert.equal(
      liveGuestJoinUrl({ token: 'abc123' }, 'https://mentorix.io'),
      'https://mentorix.io/live/join/abc123',
    )
  })
})
