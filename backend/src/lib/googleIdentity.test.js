const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  isPgUniqueViolation,
  isGoogleSubUniqueViolation,
  isUsersEmailUniqueViolation,
  looksLikeDbErrorMessage,
  publicGoogleAuthError,
  googleAccountExistsBody,
  ACCOUNT_EXISTS_AZ,
} = require('./googleIdentity');

describe('googleIdentity', () => {
  it('detects Postgres unique violations including google_sub', () => {
    const raw = {
      code: '23505',
      constraint: 'users_google_sub_unique_not_null',
      message: 'duplicate key value violates unique constraint "users_google_sub_unique_not_null"',
    };
    assert.equal(isPgUniqueViolation(raw), true);
    assert.equal(isGoogleSubUniqueViolation(raw), true);
    assert.equal(isUsersEmailUniqueViolation(raw), false);
  });

  it('detects email unique violations from message text', () => {
    const raw = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "users_email_lower_unique_not_null"',
    };
    assert.equal(isUsersEmailUniqueViolation(raw), true);
  });

  it('never returns raw DB text from publicGoogleAuthError', () => {
    const rawMsg =
      'duplicate key value violates unique constraint "users_google_sub_unique_not_null"';
    const out = publicGoogleAuthError({ code: '23505', message: rawMsg, constraint: 'users_google_sub_unique_not_null' });
    assert.equal(out.status, 409);
    assert.equal(out.body.code, 'ACCOUNT_ALREADY_EXISTS');
    assert.equal(out.body.message, ACCOUNT_EXISTS_AZ);
    assert.equal(looksLikeDbErrorMessage(out.body.message), false);
  });

  it('preserves intentional client errors under 500', () => {
    const err = new Error('Google email təsdiqlənməyib');
    err.statusCode = 409;
    const out = publicGoogleAuthError(err);
    assert.equal(out.status, 409);
    assert.equal(out.body.message, 'Google email təsdiqlənməyib');
  });

  it('masks unexpected 500 DB-looking messages', () => {
    const out = publicGoogleAuthError(new Error('relation "users" does not exist'));
    assert.equal(out.status, 500);
    assert.match(out.body.message, /Google girişi/);
  });

  it('exports stable ACCOUNT_ALREADY_EXISTS body for signup conflicts', () => {
    const body = googleAccountExistsBody();
    assert.equal(body.code, 'ACCOUNT_ALREADY_EXISTS');
    assert.match(body.message, /Google hesabı/);
  });

  it('exports detachGoogleSubFromSoftDeleted helper', () => {
    const { detachGoogleSubFromSoftDeleted } = require('./googleIdentity');
    assert.equal(typeof detachGoogleSubFromSoftDeleted, 'function');
  });
});
