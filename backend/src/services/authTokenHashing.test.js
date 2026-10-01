const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const dbPath = path.join(__dirname, '../utils/db.js');
const verifyMailPath = path.join(__dirname, 'emailVerificationService.js');

const state = { calls: [], handlers: [], sentMail: [] };
function reset() {
  state.calls = [];
  state.handlers = [];
  state.sentMail = [];
}
function on(re, rows) {
  state.handlers.push({ re, rows });
}

require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    query: async (sql, params = []) => {
      state.calls.push({ sql, params });
      const h = state.handlers.find((x) => x.re.test(sql));
      return { rows: h ? (typeof h.rows === 'function' ? h.rows(params) : h.rows) : [] };
    },
    transaction: async () => {
      throw new Error('not used');
    },
  },
};
require.cache[verifyMailPath] = {
  id: verifyMailPath,
  filename: verifyMailPath,
  loaded: true,
  exports: {
    sendVerificationEmail: async (msg) => {
      state.sentMail.push(msg);
      return { ok: true };
    },
  },
};

const { hashSecretToken, hashVerificationCode } = require('../lib/secretTokens');
const reset_ = require('./passwordResetTokenService');
const verify = require('./emailVerificationIssue');

const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function captureLogs() {
  const logs = [];
  const orig = { log: console.log, error: console.error, warn: console.warn, info: console.info };
  console.log = console.error = console.warn = console.info = (...a) => logs.push(a.map(String).join(' '));
  return { logs, restore: () => Object.assign(console, orig) };
}

test('password reset: only the hash is stored; raw token never hits SQL params or logs', async () => {
  reset();
  const cap = captureLogs();
  let issued;
  try {
    issued = await reset_.issuePasswordResetToken(USER);
  } finally {
    cap.restore();
  }
  assert.match(issued.token, /^[0-9a-f]{64}$/);
  const ins = state.calls[0];
  assert.match(ins.sql, /INSERT INTO password_reset_tokens \(user_id, token_hash, expires_at\)/);
  assert.doesNotMatch(ins.sql, /\btoken\b(?!_hash)/, 'plaintext column not written');
  assert.equal(ins.params[1], hashSecretToken(issued.token));
  assert.equal(JSON.stringify(ins.params).includes(issued.token), false);
  assert.equal(cap.logs.join('\n').includes(issued.token), false);
  const ttlMs = ins.params[2].getTime() - Date.now();
  assert.ok(ttlMs > 29 * 60 * 1000 && ttlMs <= 30 * 60 * 1000, '30 minute expiry');
});

test('password reset lookup: by hash first, never by raw value against hashed rows', async () => {
  reset();
  const raw = 'f'.repeat(64);
  on(/WHERE token_hash = \$1/, (p) => (p[0] === hashSecretToken(raw) ? [{ id: 't1', user_id: USER, expires_at: new Date(Date.now() + 60000), used_at: null }] : []));
  const row = await reset_.findPasswordResetToken(raw);
  assert.equal(row.id, 't1');
  assert.equal(state.calls.length, 1, 'no plaintext query when the hash matches');
  assert.equal(state.calls[0].params[0], hashSecretToken(raw));
});

test('password reset transition: pre-deploy plaintext rows (no hash) are still accepted', async () => {
  reset();
  on(/WHERE token = \$1 AND token_hash IS NULL/, [{ id: 'old', user_id: USER, expires_at: new Date(Date.now() + 60000), used_at: null }]);
  const row = await reset_.findPasswordResetToken('legacy-plain-token');
  assert.equal(row.id, 'old');
  assert.match(state.calls[1].sql, /token_hash IS NULL/, 'plaintext match only for rows without a hash');
  assert.equal(await reset_.findPasswordResetToken(''), null);
});

test('password reset consume: atomic single use, unexpired, plaintext cleared', async () => {
  const sqls = [];
  const client = {
    query: async (sql, params) => {
      sqls.push({ sql, params });
      return { rows: sqls.length === 1 ? [{ id: 't1' }] : [] };
    },
  };
  assert.equal(await reset_.consumePasswordResetToken(client, 't1'), true);
  assert.equal(await reset_.consumePasswordResetToken(client, 't1'), false, 'second use loses');
  assert.match(sqls[0].sql, /SET used_at = NOW\(\), token = NULL/);
  assert.match(sqls[0].sql, /WHERE id = \$1 AND used_at IS NULL AND expires_at > NOW\(\)/);
});

test('email verification issue: stores only hashes, clears plaintext, emails the raw values', async () => {
  reset();
  const cap = captureLogs();
  let out;
  try {
    out = await verify.issueEmailVerification(USER, 'student@example.org');
  } finally {
    cap.restore();
  }
  const { token, code } = state.sentMail[0];
  assert.match(token, /^[0-9a-f]{64}$/);
  assert.match(code, /^\d{6}$/);
  const upd = state.calls[0];
  assert.match(upd.sql, /verification_token_hash = \$1/);
  assert.match(upd.sql, /verification_code_hash = \$2/);
  assert.match(upd.sql, /verification_token = NULL/);
  assert.match(upd.sql, /verification_code = NULL/);
  assert.equal(upd.params[0], hashSecretToken(token));
  assert.equal(upd.params[1], hashVerificationCode(USER, code));
  assert.equal(JSON.stringify(upd.params).includes(token), false);
  assert.equal(upd.params.includes(code), false);
  assert.equal('token' in out || 'code' in out, false, 'raw values are not returned to callers');
  assert.equal(cap.logs.some((l) => l.includes(token) || l.includes(code)), false);
});

test('email verification by link: hash lookup, then plaintext only for rows without a hash', async () => {
  reset();
  const raw = 'a'.repeat(64);
  on(/WHERE verification_token_hash = \$1/, (p) => (p[0] === hashSecretToken(raw) ? [{ id: USER, email: 'x', is_verified: false }] : []));
  assert.equal((await verify.findUserForVerification({ token: raw })).id, USER);
  assert.equal(state.calls.length, 1);

  reset();
  on(/WHERE verification_token = \$1 AND verification_token_hash IS NULL/, [{ id: 'old-user', email: 'x', is_verified: false }]);
  assert.equal((await verify.findUserForVerification({ token: 'old-plain' })).id, 'old-user');
});

test('email verification by code: hashed code matches only for the right user; legacy plaintext code still works', async () => {
  reset();
  on(/AND \(verification_code_hash IS NOT NULL OR verification_code IS NOT NULL\)/, [
    { id: 'other', email: 's@example.org', is_verified: false, verification_code_hash: hashVerificationCode('other', '111111'), verification_code: null },
    { id: USER, email: 's@example.org', is_verified: false, verification_code_hash: hashVerificationCode(USER, '482913'), verification_code: null },
  ]);
  const hit = await verify.findUserForVerification({ email: ' S@Example.org ', code: '482913' });
  assert.deepEqual(Object.keys(hit).sort(), ['email', 'id', 'is_verified', 'verification_expiry']);
  assert.equal(hit.id, USER);
  assert.equal(state.calls[0].params[0], 's@example.org');
  assert.equal(state.calls[0].params.includes('482913'), false, 'code is not sent to SQL');
  assert.equal(await verify.findUserForVerification({ email: 's@example.org', code: '000000' }), null);

  reset();
  on(/verification_code_hash IS NOT NULL OR/, [{ id: 'legacy', email: 's@example.org', is_verified: false, verification_code_hash: null, verification_code: '654321' }]);
  assert.equal((await verify.findUserForVerification({ email: 's@example.org', code: '654321' })).id, 'legacy');
  assert.equal(await verify.findUserForVerification({ email: 's@example.org', code: '654320' }), null);
});

test('successful verification clears hashes and any plaintext (single use)', async () => {
  reset();
  await verify.clearVerificationFields(USER);
  const sql = state.calls[0].sql;
  for (const col of ['verification_token', 'verification_code', 'verification_token_hash', 'verification_code_hash', 'verification_expiry']) {
    assert.match(sql, new RegExp(`${col} = NULL`));
  }
});
