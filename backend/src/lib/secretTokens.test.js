const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const { generateSecretToken, hashSecretToken, hashVerificationCode, hashesEqual, generateVerificationCode } = require('./secretTokens');

test('tokens are 256-bit random hex and hash to SHA-256 hex', () => {
  const t = generateSecretToken();
  assert.match(t, /^[0-9a-f]{64}$/);
  assert.notEqual(generateSecretToken(), t);
  assert.equal(hashSecretToken(t), crypto.createHash('sha256').update(t).digest('hex'));
  assert.notEqual(hashSecretToken(t), t);
  assert.equal(hashSecretToken(` ${t} `), hashSecretToken(t), 'whitespace from copy/paste is ignored');
  assert.equal(hashSecretToken(''), null);
  assert.equal(hashSecretToken(null), null);
});

test('verification code hash is bound to the user', () => {
  const a = hashVerificationCode('user-a', '123456');
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.notEqual(a, hashVerificationCode('user-b', '123456'));
  assert.notEqual(a, hashSecretToken('123456'));
  assert.equal(hashVerificationCode('user-a', ''), null);
  assert.equal(hashVerificationCode(null, '123456'), null);
});

test('codes are 6 digits; hash comparison', () => {
  for (let i = 0; i < 50; i += 1) assert.match(generateVerificationCode(), /^[1-9]\d{5}$/);
  const h = hashSecretToken('x');
  assert.equal(hashesEqual(h, hashSecretToken('x')), true);
  assert.equal(hashesEqual(h, hashSecretToken('y')), false);
  assert.equal(hashesEqual(h, null), false);
  assert.equal(hashesEqual(h, 'short'), false);
});
