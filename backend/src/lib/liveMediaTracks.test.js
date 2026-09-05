const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { isMicTrack, isCameraTrack } = require('./liveMediaTracks');

describe('live media track matching', () => {
  it('detects microphone tracks by source name', () => {
    assert.equal(isMicTrack({ source: 'MICROPHONE' }), true);
    assert.equal(isCameraTrack({ source: 'MICROPHONE' }), false);
  });

  it('detects camera tracks and ignores screen share', () => {
    assert.equal(isCameraTrack({ source: 'CAMERA' }), true);
    assert.equal(isCameraTrack({ source: 'SCREEN_SHARE' }), false);
  });
});
