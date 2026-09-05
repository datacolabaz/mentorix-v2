const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { mapAdmission, canEnterLiveRoom, shouldReopenGuestParticipant } = require('./liveAdmissionMap');

describe('mapAdmission', () => {
  it('returns null for empty row', () => {
    assert.equal(mapAdmission(null), null);
  });

  it('exposes the fields the instructor panel needs', () => {
    const mapped = mapAdmission({
      id: 'a1',
      status: 'pending',
      display_name: 'Nihad',
      requester_kind: 'guest',
      email: 'a@b.com',
      requested_at: '2026-09-05T10:00:00Z',
      phone_number: '+994',
    });
    assert.equal(mapped.display_name, 'Nihad');
    assert.equal(mapped.requester_kind, 'guest');
    assert.equal(mapped.email, 'a@b.com');
    assert.equal(mapped.status, 'pending');
  });
});

describe('canEnterLiveRoom', () => {
  it('lets the instructor in without an admission row', () => {
    assert.equal(canEnterLiveRoom({ isInstructor: true, status: 'pending' }), true);
  });

  it('blocks students until approved', () => {
    assert.equal(canEnterLiveRoom({ isInstructor: false, status: 'pending' }), false);
    assert.equal(canEnterLiveRoom({ isInstructor: false, status: 'denied' }), false);
    assert.equal(canEnterLiveRoom({ isInstructor: false, status: 'approved' }), true);
  });
});

describe('shouldReopenGuestParticipant', () => {
  it('reopens a guest who already left', () => {
    assert.equal(shouldReopenGuestParticipant({ id: 'g1', left_at: '2026-09-05T12:00:00Z' }), true);
  });

  it('leaves an active guest row alone', () => {
    assert.equal(shouldReopenGuestParticipant({ id: 'g1', left_at: null }), false);
    assert.equal(shouldReopenGuestParticipant(null), false);
  });
});
