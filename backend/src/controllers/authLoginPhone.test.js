const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const bcrypt = require('bcryptjs');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-auth-login-phone-tests-0123456789';

const PASSWORD = 'Adm1n-Secret!';
const HASH = bcrypt.hashSync(PASSWORD, 4);

let users = [];
let queries = [];

function digits(v) {
  return String(v || '').replace(/\D/g, '');
}

const dbPath = path.join(__dirname, '../utils/db.js');
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    query: async (sql, params = []) => {
      queries.push({ sql, params });
      if (/FROM users/.test(sql) && /= ANY\(\$1::text\[\]\)/.test(sql)) {
        const wanted = new Set(params[0]);
        return {
          rows: users.filter((u) => u.is_active && u.phone && String(u.phone).trim() && wanted.has(digits(u.phone))),
        };
      }
      if (/FROM users/.test(sql) && /lower\(trim\(email\)\)/.test(sql)) {
        const e = String(params[0]).trim().toLowerCase();
        return { rows: users.filter((u) => u.is_active && String(u.email || '').toLowerCase() === e) };
      }
      return { rows: [] };
    },
    transaction: async () => {
      throw new Error('not used');
    },
  },
};

const { login } = require('./authController');

function call(body) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        resolve({ status: this.statusCode, body: payload });
      },
    };
    login({ body, headers: {}, originalUrl: '/api/auth/login' }, res);
  });
}

function adminWithPhone(phone, extra = {}) {
  return {
    id: 'a1',
    role: 'admin',
    full_name: 'Admin',
    email: 'admin@edupanel.co',
    phone,
    password_hash: HASH,
    is_active: true,
    is_verified: true,
    ...extra,
  };
}

describe('POST /auth/login phone normalization', () => {
  beforeEach(() => {
    users = [];
    queries = [];
  });

  const typedFormats = [
    '050 123 45 67',
    '0501234567',
    '(050) 123-45-67',
    '994501234567',
    '+994 50 123 45 67',
    '+994-50-123-45-67',
    '501234567',
  ];

  for (const stored of ['+994501234567', '0501234567', '050 123 45 67', '501234567']) {
    it(`matches an admin stored as "${stored}" from every typed format`, async () => {
      users = [adminWithPhone(stored)];
      for (const typed of typedFormats) {
        const r = await call({ identifier: typed, password: PASSWORD });
        assert.equal(r.status, 200, `${typed} -> ${JSON.stringify(r.body)}`);
        assert.equal(r.body.user.id, 'a1');
      }
    });
  }

  it('uses a single index-friendly ANY() lookup with the partial-index predicate', async () => {
    users = [adminWithPhone('+994501234567')];
    await call({ identifier: '050 123 45 67', password: PASSWORD });
    const q = queries.find((x) => /= ANY\(\$1::text\[\]\)/.test(x.sql));
    assert.ok(q, 'phone lookup query not issued');
    assert.match(q.sql, /phone IS NOT NULL/);
    assert.match(q.sql, /trim\(COALESCE\(phone::text, ''\)\) <> ''/);
    assert.deepEqual(q.params[0], ['994501234567', '0501234567', '501234567']);
  });

  it('keeps emails with @ on the email path, even with many digits', async () => {
    users = [adminWithPhone('+994501234567', { email: 'ali123456789@gmail.com' })];
    const r = await call({ identifier: 'ali123456789@gmail.com', password: PASSWORD });
    assert.equal(r.status, 200);
    assert.ok(!queries.some((x) => /= ANY\(/.test(x.sql)), 'email must not trigger phone lookup');
  });

  it('prefers the admin when the same number is on a student in another format', async () => {
    users = [
      { id: 's1', role: 'student', phone: '+994501234567', password_hash: HASH, is_active: true, is_verified: true },
      adminWithPhone('0501234567'),
    ];
    const r = await call({ identifier: '+994 50 123 45 67', password: PASSWORD });
    assert.equal(r.status, 200);
    assert.equal(r.body.user.id, 'a1');
  });

  it('refuses (401) when two admins share the number in different formats', async () => {
    users = [adminWithPhone('+994501234567'), adminWithPhone('0501234567', { id: 'a2' })];
    const r = await call({ identifier: '0501234567', password: PASSWORD });
    assert.equal(r.status, 401);
  });

  it('still returns 401 for a wrong password and 403 for a non-admin', async () => {
    users = [adminWithPhone('+994501234567')];
    assert.equal((await call({ identifier: '0501234567', password: 'nope' })).status, 401);

    users = [{ id: 'i1', role: 'instructor', phone: '+994501234567', password_hash: HASH, is_active: true, is_verified: true }];
    assert.equal((await call({ identifier: '0501234567', password: PASSWORD })).status, 403);
  });

  it('does not match a different number', async () => {
    users = [adminWithPhone('+994501234567')];
    assert.equal((await call({ identifier: '0501234568', password: PASSWORD })).status, 401);
  });
});
