const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  isGoogleAuthUser,
  isUserEmailVerified,
  googleLoginRequiredBody,
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
});
