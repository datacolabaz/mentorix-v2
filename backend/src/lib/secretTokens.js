/**
 * Single-use secrets sent by email (password reset link, email verification link + code).
 * Only a SHA-256 hash is stored; the raw value exists in memory and in the email only.
 * Lookups are by hash equality in SQL, so no timing-safe compare is needed for tokens.
 */
const crypto = require('crypto');

const TOKEN_BYTES = 32;

function generateSecretToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString('hex');
}

function hashSecretToken(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

/** 6-digit codes are low-entropy: bind the hash to the user so equal codes never share a hash. */
function hashVerificationCode(userId, code) {
  const c = String(code ?? '').trim();
  if (!userId || !c) return null;
  return crypto.createHash('sha256').update(`email_verification_code:${userId}:${c}`, 'utf8').digest('hex');
}

function hashesEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

function generateVerificationCode() {
  return String(crypto.randomInt(100000, 1000000));
}

module.exports = { generateSecretToken, hashSecretToken, hashVerificationCode, hashesEqual, generateVerificationCode };
