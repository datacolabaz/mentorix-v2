const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  azNationalDigits,
  phoneLookupCandidates,
  classifyLoginIdentifier,
  pickPhoneLoginUser,
} = require('./loginIdentifier');

const AZ_CANDIDATES = ['994501234567', '0501234567', '501234567'];

describe('classifyLoginIdentifier', () => {
  it('treats anything with @ as email, even with 9+ digits', () => {
    assert.deepEqual(classifyLoginIdentifier(' admin@edupanel.co '), { kind: 'email', value: 'admin@edupanel.co' });
    assert.deepEqual(classifyLoginIdentifier('ali123456789@gmail.com'), { kind: 'email', value: 'ali123456789@gmail.com' });
    assert.deepEqual(classifyLoginIdentifier('+994501234567@x.az'), { kind: 'email', value: '+994501234567@x.az' });
  });

  it('maps every common AZ phone format to the same lookup candidates', () => {
    for (const input of [
      '050 123 45 67',
      '0501234567',
      '(050) 123-45-67',
      '994501234567',
      '+994 50 123 45 67',
      '+994-50-123-45-67',
      '+994 (50) 123 45 67',
      '00994 50 123 45 67',
      '50 123 45 67',
      '501234567',
    ]) {
      const r = classifyLoginIdentifier(input);
      assert.equal(r.kind, 'phone', input);
      assert.deepEqual(r.candidates, AZ_CANDIDATES, input);
    }
  });

  it('keeps unknown-format numbers as an exact digit match', () => {
    const r = classifyLoginIdentifier('+1 415 555 0100');
    assert.equal(r.kind, 'phone');
    assert.deepEqual(r.candidates, ['14155550100']);
  });

  it('falls back to email lookup for short non-@ input and empty for blank', () => {
    assert.deepEqual(classifyLoginIdentifier('admin'), { kind: 'email', value: 'admin' });
    assert.deepEqual(classifyLoginIdentifier('12345678'), { kind: 'email', value: '12345678' });
    assert.deepEqual(classifyLoginIdentifier('   '), { kind: null, value: '' });
    assert.deepEqual(classifyLoginIdentifier(null), { kind: null, value: '' });
  });
});

describe('azNationalDigits / phoneLookupCandidates', () => {
  it('extracts the 9-digit national part only from recognised shapes', () => {
    assert.equal(azNationalDigits('994501234567'), '501234567');
    assert.equal(azNationalDigits('00994501234567'), '501234567');
    assert.equal(azNationalDigits('0501234567'), '501234567');
    assert.equal(azNationalDigits('501234567'), '501234567');
    assert.equal(azNationalDigits('1501234567'), null);
    assert.equal(azNationalDigits('9945012345678'), null);
  });

  it('returns [] for empty input', () => {
    assert.deepEqual(phoneLookupCandidates(''), []);
  });
});

describe('pickPhoneLoginUser', () => {
  it('returns the single match or null', () => {
    assert.equal(pickPhoneLoginUser([], AZ_CANDIDATES), null);
    const u = { id: 1, role: 'admin', phone: '+994501234567' };
    assert.equal(pickPhoneLoginUser([u], AZ_CANDIDATES), u);
  });

  it('prefers the only admin when formats collide across accounts', () => {
    const student = { id: 1, role: 'student', phone: '+994501234567' };
    const admin = { id: 2, role: 'admin', phone: '050 123 45 67' };
    assert.equal(pickPhoneLoginUser([student, admin], AZ_CANDIDATES), admin);
  });

  it('is ambiguous (null) when several admins share the number', () => {
    const a = { id: 1, role: 'admin', phone: '+994501234567' };
    const b = { id: 2, role: 'admin', phone: '0501234567' };
    assert.equal(pickPhoneLoginUser([a, b], AZ_CANDIDATES), null);
  });

  it('without admins, picks the canonical +994 form deterministically', () => {
    const local = { id: 1, role: 'instructor', phone: '0501234567' };
    const canon = { id: 2, role: 'student', phone: '+994 50 123 45 67' };
    assert.equal(pickPhoneLoginUser([local, canon], AZ_CANDIDATES), canon);
  });
});
