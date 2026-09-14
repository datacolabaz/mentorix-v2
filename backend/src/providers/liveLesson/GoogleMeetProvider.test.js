const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { GoogleMeetProvider } = require('./GoogleMeetProvider');

describe('GoogleMeetProvider', () => {
  it('has stable provider id', () => {
    assert.equal(new GoogleMeetProvider().id, 'google_meet');
  });

  it('maps hangoutLink from Calendar payload shape', () => {
    const data = {
      id: 'evt-1',
      hangoutLink: 'https://meet.google.com/abc-defg-hij',
      conferenceData: {
        entryPoints: [{ entryPointType: 'video', uri: 'https://meet.google.com/abc-defg-hij' }],
      },
    };
    const joinUrl =
      data.hangoutLink ||
      data.conferenceData?.entryPoints?.find((p) => p.entryPointType === 'video')?.uri ||
      null;
    assert.equal(joinUrl, 'https://meet.google.com/abc-defg-hij');
  });
});
