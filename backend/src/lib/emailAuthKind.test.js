const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  isGoogleAuthUser,
  isUserEmailVerified,
  googleLoginRequiredBody,
  canAdoptLoginPassword,
} = require('../lib/emailAuthKind');

describe('emailAuthKind', () => {
  it('treats Google-linked accounts as verified without an email code', () => {
    assert.equal(isGoogleAuthUser({ google_sub: 'abc' }), true);
    assert.equal(isGoogleAuthUser({ auth_provider: 'google', is_verified: false }), true);
    assert.equal(isGoogleAuthUser({ is_verified: false }), false);
    assert.equal(isUserEmailVerified({ google_sub: 'abc', is_verified: false }), true);
    assert.equal(isUserEmailVerified({ is_verified: false }), false);
    assert.equal(isUserEmailVerified({ is_verified: true }), true);
  });

  it('returns GOOGLE_LOGIN_REQUIRED payload for Google-only login', () => {
    const body = googleLoginRequiredBody();
    assert.equal(body.code, 'GOOGLE_LOGIN_REQUIRED');
    assert.match(body.message, /Google/);
  });

  it('lets a Google participant adopt the password they type on login', () => {
    const student = { role: 'student', google_sub: 'abc', password_hash: 'placeholder' };
    assert.equal(canAdoptLoginPassword(student, 'Parol1234', false), true);
    assert.equal(canAdoptLoginPassword(student, 'short', false), false);
    assert.equal(canAdoptLoginPassword(student, 'Parol1234', true), false);
    assert.equal(
      canAdoptLoginPassword({ role: 'instructor', google_sub: 'abc' }, 'Parol1234', false),
      false,
    );
    assert.equal(
      canAdoptLoginPassword({ role: 'student', password_hash: 'real' }, 'Parol1234', false),
      false,
    );
    assert.equal(
      canAdoptLoginPassword({ role: 'student', password_hash: null }, 'Parol1234', false),
      true,
    );
  });
});
