const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { ALLOWED_PROVIDERS, publicConnection } = require('../services/teacherProviderConnectionService');

describe('teacherProviderConnectionService contracts', () => {
  it('only allows google_meet / zoom / teams connection providers', () => {
    assert.ok(ALLOWED_PROVIDERS.has('google_meet'));
    assert.ok(ALLOWED_PROVIDERS.has('zoom'));
    assert.ok(ALLOWED_PROVIDERS.has('teams'));
    assert.equal(ALLOWED_PROVIDERS.has('mentorix_live'), false);
  });

  it('publicConnection never exposes tokens', () => {
    const pub = publicConnection({
      provider: 'google_meet',
      status: 'active',
      account_email: 't@example.com',
      provider_account_id: 'sub-1',
      access_token_enc: 'v1:secret',
      refresh_token_enc: 'v1:secret2',
      token_expires_at: '2030-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    });
    assert.equal(pub.connected, true);
    assert.equal(pub.account_email, 't@example.com');
    assert.equal('access_token_enc' in pub, false);
    assert.equal('refresh_token_enc' in pub, false);
    assert.equal('access_token' in pub, false);
    assert.equal('refresh_token' in pub, false);
  });
});
