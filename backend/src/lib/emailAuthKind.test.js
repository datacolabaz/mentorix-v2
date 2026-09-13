const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  isGoogleAuthUser,
  isUserEmailVerified,
  googleLoginRequiredBody,
  canAdoptLoginPassword,
  hasUserChosenPassword,
  passwordLoginFailureBody,
  normalizePasswordInput,
} = require('../lib/emailAuthKind');

const GOOGLE_PLACEHOLDER = '$2a$10$googleplaceholderhashxxxx';
const EMAIL_HASH = '$2b$12$realuserpasswordhashxxxxxxx';

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

  it('flags Google-only accounts so email login can refuse without silent adopt', () => {
    const student = { role: 'student', google_sub: 'abc', password_hash: GOOGLE_PLACEHOLDER };
    assert.equal(hasUserChosenPassword(student), false);
    assert.equal(passwordLoginFailureBody(student).code, 'GOOGLE_LOGIN_REQUIRED');
    // Helper still describes “could adopt”, but loginWithEmail must not auto-set password.
    assert.equal(canAdoptLoginPassword(student, 'Parol1234', false), true);
    assert.equal(canAdoptLoginPassword(student, 'short', false), false);
    assert.equal(
      canAdoptLoginPassword({ role: 'student', password_hash: 'real' }, 'Parol1234', false),
      false,
    );
  });

  it('treats Google cost-10 hashes as not user-chosen', () => {
    assert.equal(hasUserChosenPassword({ google_sub: 'x', password_hash: GOOGLE_PLACEHOLDER }), false);
    assert.equal(hasUserChosenPassword({ google_sub: 'x', password_hash: EMAIL_HASH }), true);
    assert.equal(hasUserChosenPassword({ password_hash: EMAIL_HASH }), true);
  });

  it('hints password reset when a real password exists but does not match', () => {
    const body = passwordLoginFailureBody({
      google_sub: 'x',
      password_hash: EMAIL_HASH,
    });
    assert.equal(body.code, 'INVALID_CREDENTIALS');
    assert.match(body.message, /unut/i);
  });

  it('trims passwords so mobile autofill spaces do not fail login', () => {
    assert.equal(normalizePasswordInput('  Secret123  '), 'Secret123');
  });
});
