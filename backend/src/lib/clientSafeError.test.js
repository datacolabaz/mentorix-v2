const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  isPostgresError,
  toClientSafeError,
  toOnboardingClientError,
} = require('./clientSafeError');

describe('clientSafeError', () => {
  it('keeps app 4xx messages', () => {
    const err = new Error('İstifadə məqsədini seçin');
    err.statusCode = 400;
    err.code = 'INVALID_PERSONA';
    assert.deepEqual(toOnboardingClientError(err), {
      status: 400,
      message: 'İstifadə məqsədini seçin',
      code: 'INVALID_PERSONA',
    });
  });

  it('hides Postgres ON CONFLICT errors', () => {
    const err = new Error(
      'there is no unique or exclusion constraint matching the ON CONFLICT specification',
    );
    err.code = '42P10';
    const out = toOnboardingClientError(err);
    assert.equal(out.status, 500);
    assert.equal(out.code, 'ONBOARDING_SAVE_FAILED');
    assert.equal(/ON CONFLICT/i.test(out.message), false);
    assert.match(out.message, /Profili yadda saxlamaq/i);
  });

  it('detects postgres SQLSTATE codes', () => {
    assert.equal(isPostgresError({ code: '23505', message: 'duplicate' }), true);
    assert.equal(isPostgresError({ code: 'INVALID_PERSONA' }), false);
  });

  it('uses generic server fallback for unexpected errors', () => {
    const out = toClientSafeError(new Error('ECONNREFUSED 127.0.0.1:5432'));
    assert.equal(out.status, 500);
    assert.equal(/ECONNREFUSED/.test(out.message), false);
  });
});
