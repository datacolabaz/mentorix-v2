const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { frontendBaseUrl, publicJoinUrl } = require('./frontendBaseUrl');

const ENV_KEYS = ['FRONTEND_URL', 'FRONTEND_BASE_URL', 'PUBLIC_APP_URL', 'APP_URL'];

describe('frontendBaseUrl', () => {
  const prev = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      prev[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (prev[key] === undefined) delete process.env[key];
      else process.env[key] = prev[key];
    }
  });

  it('falls back to mentorix.io when env and request are empty', () => {
    assert.equal(frontendBaseUrl(), 'https://mentorix.io');
  });

  it('ignores scheme-less APP_URL so WhatsApp never gets a relative path', () => {
    process.env.APP_URL = '/';
    assert.equal(frontendBaseUrl(), 'https://mentorix.io');
  });

  it('uses request Origin when env is empty', () => {
    assert.equal(
      frontendBaseUrl({ headers: { origin: 'https://app.mentorix.io/' } }),
      'https://app.mentorix.io',
    );
  });

  it('prefers FRONTEND_URL', () => {
    process.env.APP_URL = 'https://wrong.example';
    process.env.FRONTEND_URL = 'https://mentorix.io/';
    assert.equal(frontendBaseUrl(), 'https://mentorix.io');
  });
});

describe('publicJoinUrl', () => {
  const prev = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      prev[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (prev[key] === undefined) delete process.env[key];
      else process.env[key] = prev[key];
    }
  });

  it('never returns a relative /live/join path', () => {
    const url = publicJoinUrl('/live/join/abc', {});
    assert.equal(url, 'https://mentorix.io/live/join/abc');
    assert.match(url, /^https:\/\//);
  });

  it('keeps an already-absolute join url', () => {
    assert.equal(
      publicJoinUrl('https://mentorix.io/live/join/abc', {}),
      'https://mentorix.io/live/join/abc',
    );
  });
});
