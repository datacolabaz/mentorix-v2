const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { encrypt, decrypt, parseKey, generateKeyBase64, VERSION } = require('./tokenCrypto');

describe('tokenCrypto', () => {
  const prev = process.env.PROVIDER_TOKEN_ENCRYPTION_KEY;

  before(() => {
    process.env.PROVIDER_TOKEN_ENCRYPTION_KEY = generateKeyBase64();
  });

  after(() => {
    if (prev === undefined) delete process.env.PROVIDER_TOKEN_ENCRYPTION_KEY;
    else process.env.PROVIDER_TOKEN_ENCRYPTION_KEY = prev;
  });

  it('round-trips plaintext', () => {
    const secret = 'refresh-token-value-çətin';
    const enc = encrypt(secret);
    assert.ok(enc.startsWith(`${VERSION}:`));
    assert.equal(decrypt(enc), secret);
  });

  it('returns null for empty input', () => {
    assert.equal(encrypt(null), null);
    assert.equal(decrypt(''), null);
  });

  it('rejects invalid key length', () => {
    assert.throws(() => parseKey('too-short'), /32 bayt/);
  });

  it('accepts hex keys', () => {
    const hex = Buffer.alloc(32, 7).toString('hex');
    const key = parseKey(hex);
    assert.equal(key.length, 32);
  });

  it('fails decrypt on tampered ciphertext', () => {
    const enc = encrypt('hello');
    const parts = enc.split(':');
    parts[3] = Buffer.from('tampered').toString('base64');
    assert.throws(() => decrypt(parts.join(':')));
  });
});
