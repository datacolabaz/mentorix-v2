const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeRefCode, generateCode } = require('./partnerAttributionService');

describe('partner attribution helpers', () => {
  it('normalizes referral codes', () => {
    assert.equal(normalizeRefCode('  Mx_ABC-12  '), 'mx_abc-12');
    assert.equal(normalizeRefCode('bad code!!'), 'badcode');
    assert.equal(normalizeRefCode('ab'), 'ab');
  });

  it('generates opaque codes', () => {
    const a = generateCode('mx');
    const b = generateCode('mx');
    assert.match(a, /^mx[a-f0-9]+$/);
    assert.notEqual(a, b);
  });
});
