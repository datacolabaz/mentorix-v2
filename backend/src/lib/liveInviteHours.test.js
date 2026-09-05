const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { clampInviteHours, inviteHoursUntil } = require('./liveInviteHours');

describe('clampInviteHours', () => {
  it('defaults and caps at 14 days', () => {
    assert.equal(clampInviteHours(null), 24);
    assert.equal(clampInviteHours(5000), 336);
    assert.equal(clampInviteHours(48), 48);
  });
});

describe('inviteHoursUntil', () => {
  it('adds a day after a tomorrow start so the link does not expire overnight', () => {
    const now = Date.parse('2026-09-05T10:00:00Z');
    const scheduled = '2026-09-06T14:00:00Z';
    assert.equal(inviteHoursUntil(scheduled, now), 52);
  });

  it('stays at 24 hours when there is no schedule', () => {
    assert.equal(inviteHoursUntil(null), 24);
  });
});
