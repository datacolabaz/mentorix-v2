const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const registry = require('./registry');

describe('liveLesson registry', () => {
  it('normalizes aliases', () => {
    assert.equal(registry.normalizeProviderId('Google-Meet'), 'google_meet');
    assert.equal(registry.normalizeProviderId('livekit'), 'mentorix_live');
    assert.equal(registry.normalizeProviderId('meet'), 'google_meet');
  });

  it('returns mentorix and google meet providers', () => {
    assert.equal(registry.get('mentorix_live').id, 'mentorix_live');
    assert.equal(registry.get('google_meet').id, 'google_meet');
  });

  it('rejects unknown provider', () => {
    assert.throws(() => registry.get('skype'), (err) => err.status === 400);
  });

  it('lists public providers with zoom/teams coming soon', () => {
    const list = registry.listPublicProviders();
    assert.ok(list.find((p) => p.id === 'google_meet' && p.available));
    assert.ok(list.find((p) => p.id === 'zoom' && p.comingSoon));
  });

  it('mentorix is always connected', async () => {
    const ok = await registry.get('mentorix_live').isConnected('any');
    assert.equal(ok, true);
  });

  it('zoom/teams createMeeting returns 501', async () => {
    await assert.rejects(
      () => registry.get('zoom').createMeeting('x', { title: 't' }),
      (err) => err.status === 501 && err.code === 'PROVIDER_NOT_IMPLEMENTED',
    );
  });
});
