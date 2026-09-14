/**
 * AES-256-GCM encrypt/decrypt for OAuth tokens at rest.
 * Ciphertext format: v1:<iv_b64>:<tag_b64>:<ct_b64>
 *
 * Env: PROVIDER_TOKEN_ENCRYPTION_KEY — 32-byte key as base64 or 64-char hex.
 */

const crypto = require('crypto');

const VERSION = 'v1';
const KEY_BYTES = 32;

function parseKey(raw) {
  const value = String(raw || '').trim();
  if (!value) {
    const err = new Error('PROVIDER_TOKEN_ENCRYPTION_KEY konfiqurasiya olunmayıb');
    err.status = 500;
    err.code = 'TOKEN_ENCRYPTION_KEY_MISSING';
    throw err;
  }
  if (/^[0-9a-fA-F]{64}$/.test(value)) {
    return Buffer.from(value, 'hex');
  }
  const fromB64 = Buffer.from(value, 'base64');
  if (fromB64.length === KEY_BYTES) return fromB64;
  const err = new Error('PROVIDER_TOKEN_ENCRYPTION_KEY 32 bayt olmalıdır (base64 və ya 64 hex)');
  err.status = 500;
  err.code = 'TOKEN_ENCRYPTION_KEY_INVALID';
  throw err;
}

function getKey() {
  return parseKey(process.env.PROVIDER_TOKEN_ENCRYPTION_KEY);
}

function encrypt(plaintext) {
  if (plaintext == null || plaintext === '') return null;
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
}

function decrypt(payload) {
  if (payload == null || payload === '') return null;
  const parts = String(payload).split(':');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    const err = new Error('Şifrələnmiş token formatı etibarsızdır');
    err.status = 500;
    err.code = 'TOKEN_CIPHERTEXT_INVALID';
    throw err;
  }
  const [, ivB64, tagB64, ctB64] = parts;
  const key = getKey();
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const ct = Buffer.from(ctB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

/** Generate a random 32-byte key (base64) for ops docs / local setup. */
function generateKeyBase64() {
  return crypto.randomBytes(KEY_BYTES).toString('base64');
}

module.exports = {
  encrypt,
  decrypt,
  parseKey,
  generateKeyBase64,
  VERSION,
};
