const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { livekitHttpUrl } = require('./livekitConfig');

describe('livekitHttpUrl', () => {
  it('converts wss LiveKit URLs to https for RoomService', () => {
    assert.equal(livekitHttpUrl('wss://demo.livekit.cloud'), 'https://demo.livekit.cloud');
  });

  it('converts ws URLs to http', () => {
    assert.equal(livekitHttpUrl('ws://localhost:7880'), 'http://localhost:7880');
  });
});
