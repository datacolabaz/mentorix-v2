/**
 * Portal logins over HTTP on real PostgreSQL: /auth/login (admin password), /auth/login/email,
 * /auth/google/login, /auth/google/complete with `portal`. The server decides; no token without the role;
 * the active cabinet (users.role) switches only between roles the account already holds; no sign-up.
 * Isolated throwaway schema on a local database only (TEST_DATABASE_URL).
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const express = require('express');
const bcrypt = require('bcryptjs');

const URL_VALUE = process.env.TEST_DATABASE_URL;

const id = () => randomUUID();
const STUDENT = id();
const TEACHER = id();
const BOTH = id(); // student + teacher
const ORG_OWNER = id();
const ADMIN = id();
const NOBODY = id(); // account without any role
const ORG = id();
const PASSWORD = 'Correct-Horse-9';

const FIXTURE = `
CREATE TABLE users (
  id UUID PRIMARY KEY, full_name TEXT NOT NULL DEFAULT 'U', email TEXT, phone TEXT, password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'student', account_status TEXT DEFAULT 'active', is_active BOOLEAN DEFAULT TRUE,
  is_verified BOOLEAN DEFAULT TRUE, deleted_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW(),
  persona TEXT, persona_profile JSONB DEFAULT '{}'::jsonb, role_selected BOOLEAN DEFAULT TRUE,
  onboarding_completed BOOLEAN DEFAULT TRUE, phone_verified BOOLEAN DEFAULT FALSE, phone_verified_at TIMESTAMPTZ,
  auth_provider TEXT, google_sub TEXT, google_email_verified BOOLEAN, google_picture_url TEXT,
  google_linked_at TIMESTAMPTZ, last_google_login_at TIMESTAMPTZ, locale TEXT, last_activity_at TIMESTAMPTZ
);
CREATE TABLE user_roles (user_id UUID, role TEXT, is_active BOOLEAN DEFAULT TRUE, UNIQUE (user_id, role));
CREATE TABLE instructor_profiles (user_id UUID UNIQUE, subject TEXT, billing_type TEXT, public_label TEXT, avatar_url TEXT);
CREATE TABLE course_profiles (user_id UUID UNIQUE, course_name TEXT, logo_url TEXT, branch_address TEXT, updated_at TIMESTAMPTZ);
CREATE TABLE student_profiles (user_id UUID UNIQUE, parent_id UUID);
CREATE TABLE enrollments (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), student_id UUID, instructor_id UUID, status TEXT, deleted_at TIMESTAMPTZ);
CREATE TABLE courses (id UUID PRIMARY KEY, owner_user_id UUID, name TEXT, is_organization BOOLEAN DEFAULT FALSE);
CREATE TABLE org_permissions (key TEXT PRIMARY KEY, group_name TEXT);
CREATE TABLE org_roles (key TEXT PRIMARY KEY, name_az TEXT, sort_order INT);
CREATE TABLE org_role_permissions (role_key TEXT, permission_key TEXT, PRIMARY KEY (role_key, permission_key));
CREATE TABLE org_memberships (course_id UUID, user_id UUID, role_key TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (course_id, user_id));
CREATE TABLE platform_feature_flags (key TEXT PRIMARY KEY, enabled BOOLEAN);
INSERT INTO platform_feature_flags VALUES ('access.teacher_role_approval.enabled', TRUE);
`;

test('portal logins on real PostgreSQL', { skip: !URL_VALUE && 'TEST_DATABASE_URL not set' }, async (t) => {
  const url = new URL(URL_VALUE);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'Refusing a non-local database');
  const schema = `portal_${randomUUID().replaceAll('-', '')}`;
  const admin = new Pool({ connectionString: URL_VALUE, ssl: false });
  await admin.query(`CREATE SCHEMA ${schema}`);
  const pool = new Pool({ connectionString: URL_VALUE, options: `-c search_path=${schema},pg_catalog,public`, ssl: false, max: 10 });

  const env = { ...process.env };
  process.env.LEGACY_PASSWORD_LOGIN_ENABLED = 'true';
  process.env.GOOGLE_CLIENT_ID = 'test-client';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'portal-test-secret-portal-test-secret-123';

  const { OAuth2Client } = require('google-auth-library');
  const originalVerify = OAuth2Client.prototype.verifyIdToken;
  // Test credential = JSON payload; real tokens are verified by google-auth-library in production.
  OAuth2Client.prototype.verifyIdToken = async ({ idToken }) => ({ getPayload: () => JSON.parse(idToken) });

  const globalDb = require('../utils/db');
  const original = { query: globalDb.query, transaction: globalDb.transaction };
  globalDb.query = (...a) => pool.query(...a);
  globalDb.transaction = async (fn) => {
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      const out = await fn(c);
      await c.query('COMMIT');
      return out;
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    } finally {
      c.release();
    }
  };

  delete require.cache[require.resolve('../routes/auth')];
  const app = express();
  app.use(express.json());
  app.use('/api/auth', require('../routes/auth'));
  app.use('/api/public', require('../routes/public'));
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    OAuth2Client.prototype.verifyIdToken = originalVerify;
    globalDb.query = original.query;
    globalDb.transaction = original.transaction;
    process.env = env;
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  });

  await pool.query(FIXTURE);
  const hash = await bcrypt.hash(PASSWORD, 4);
  const users = [
    [STUDENT, 'student@x.az', 'student', 'student'],
    [TEACHER, 'teacher@x.az', 'instructor', 'teacher'],
    [BOTH, 'both@x.az', 'student', 'student'],
    [ORG_OWNER, 'org@x.az', 'course', 'education_center'],
    [ADMIN, 'admin@x.az', 'admin', null],
    [NOBODY, 'nobody@x.az', 'student', null],
  ];
  for (const [uid, email, role, persona] of users) {
    await pool.query(
      `INSERT INTO users (id, email, role, persona, password_hash, google_sub, onboarding_completed)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [uid, email, role, persona, hash, `g-${uid}`, persona != null || role === 'admin'],
    );
  }
  await pool.query(`INSERT INTO user_roles (user_id, role) VALUES ($1,'student'),($2,'instructor'),($3,'student'),($3,'instructor')`, [STUDENT, TEACHER, BOTH]);
  await pool.query(`INSERT INTO instructor_profiles (user_id) VALUES ($1),($2)`, [TEACHER, BOTH]);
  await pool.query(`INSERT INTO student_profiles (user_id) VALUES ($1),($2)`, [STUDENT, BOTH]);
  await pool.query(`INSERT INTO courses VALUES ($1,$2,'Akademiya',TRUE)`, [ORG, ORG_OWNER]);
  await pool.query(`INSERT INTO org_roles (key) VALUES ('owner'),('org_admin'),('instructor')`);
  await pool.query(`INSERT INTO org_memberships (course_id, user_id, role_key) VALUES ($1,$2,'owner')`, [ORG, ORG_OWNER]);

  const base = `http://127.0.0.1:${server.address().port}/api`;
  const post = async (p, body) => {
    const r = await fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return { status: r.status, body: await r.json() };
  };
  const google = (uid, extra = {}) => JSON.stringify({ sub: `g-${uid}`, email: users.find((u) => u[0] === uid)?.[1], email_verified: true, ...extra });
  const activeRole = async (uid) => (await pool.query('SELECT role FROM users WHERE id = $1', [uid])).rows[0].role;

  await t.test('auth-options tells the page which forms to show', async () => {
    const r = await fetch(`${base}/public/auth-options`).then((x) => x.json());
    assert.equal(r.password_login, true);
    assert.equal(r.admin_password_login, true);
    assert.deepEqual(r.portals, ['student', 'instructor', 'organization', 'admin']);
  });

  await t.test('matching role → token, active cabinet = portal role, redirect path', async () => {
    const cases = [
      [STUDENT, 'student', 'student', '/student'],
      [TEACHER, 'instructor', 'instructor', '/instructor'],
      [ORG_OWNER, 'organization', 'course', '/org'],
    ];
    for (const [uid, portal, role, path] of cases) {
      const r = await post('/auth/google/login', { credential: google(uid), portal });
      assert.equal(r.status, 200, `${portal}: ${JSON.stringify(r.body)}`);
      assert.ok(r.body.token);
      assert.equal(r.body.user.role, role);
      assert.equal(r.body.redirect, path);
      assert.equal(await activeRole(uid), role);
    }
    const a = await post('/auth/login', { identifier: 'admin@x.az', password: PASSWORD, portal: 'admin' });
    assert.equal(a.status, 200);
    assert.equal(a.body.user.role, 'admin');
  });

  await t.test('missing role → 403 with the portal message and NO token (all four portals)', async () => {
    const cases = [
      [TEACHER, 'student', 'Bu hesabda iştirakçı girişi üçün icazə yoxdur.'],
      [STUDENT, 'instructor', 'Bu hesabda təlimçi girişi üçün icazə yoxdur.'],
      [TEACHER, 'organization', 'Bu hesabda təşkilat girişi üçün icazə yoxdur.'],
      [STUDENT, 'admin', 'Bu hesabda admin girişi üçün icazə yoxdur.'],
      [ADMIN, 'student', 'Bu hesabda iştirakçı girişi üçün icazə yoxdur.'],
    ];
    for (const [uid, portal, message] of cases) {
      const before = await activeRole(uid);
      const r = await post('/auth/google/login', { credential: google(uid), portal });
      assert.equal(r.status, 403, `${portal}`);
      assert.equal(r.body.code, 'PORTAL_ROLE_REQUIRED');
      assert.equal(r.body.message, message);
      assert.equal(r.body.token, undefined);
      assert.equal(await activeRole(uid), before, 'active cabinet unchanged');
    }
  });

  await t.test('a teacher (who also holds the course panel) is not an organization admin', async () => {
    const r = await post('/auth/login/email', { email: 'teacher@x.az', password: PASSWORD, portal: 'organization' });
    assert.equal(r.status, 403);
    assert.equal(r.body.token, undefined);
  });

  await t.test('student + teacher account can enter both cabinets, nothing else', async () => {
    const s = await post('/auth/login/email', { email: 'both@x.az', password: PASSWORD, portal: 'student' });
    assert.equal(s.status, 200);
    assert.equal(await activeRole(BOTH), 'student');
    const i = await post('/auth/login/email', { email: 'both@x.az', password: PASSWORD, portal: 'instructor' });
    assert.equal(i.status, 200);
    assert.equal(i.body.redirect, '/instructor');
    assert.equal(await activeRole(BOTH), 'instructor');
    const o = await post('/auth/login/email', { email: 'both@x.az', password: PASSWORD, portal: 'organization' });
    assert.equal(o.status, 403);
    const roles = await pool.query(`SELECT role FROM user_roles WHERE user_id = $1 AND role NOT IN ('course') ORDER BY role`, [BOTH]);
    assert.deepEqual(roles.rows.map((r) => r.role), ['instructor', 'student'], 'no role was added');
  });

  await t.test('portal login never grants a role or creates an account', async () => {
    const r = await post('/auth/google/login', { credential: google(NOBODY), portal: 'instructor' });
    assert.equal(r.status, 403);
    assert.equal(r.body.can_register, true);
    const reqs = await pool.query(`SELECT to_regclass('role_requests') AS t`);
    assert.equal(reqs.rows[0].t, null, 'no role request side effect needed or created');
    const newcomer = JSON.stringify({ sub: 'g-brand-new', email: 'new@x.az', email_verified: true });
    for (const p of ['/auth/google/login', '/auth/google/complete']) {
      const n = await post(p, { credential: newcomer, portal: 'student' });
      assert.equal(n.status, 403, p);
      assert.equal(n.body.can_register, true);
    }
    const count = await pool.query(`SELECT COUNT(*)::int AS n FROM users WHERE email = 'new@x.az'`);
    assert.equal(count.rows[0].n, 0);
  });

  await t.test('wrong password / unknown portal are rejected before any role logic', async () => {
    assert.equal((await post('/auth/login/email', { email: 'student@x.az', password: 'nope', portal: 'student' })).status, 401);
    const bad = await post('/auth/login/email', { email: 'student@x.az', password: PASSWORD, portal: 'superuser' });
    assert.equal(bad.status, 400);
    assert.equal(bad.body.code, 'PORTAL_INVALID');
  });

  await t.test('without portal the legacy behaviour is unchanged', async () => {
    const r = await post('/auth/login', { identifier: 'student@x.az', password: PASSWORD });
    assert.equal(r.status, 403);
    assert.equal(r.body.message, 'Yalnız admin bu girişlə daxil ola bilər');
    const g = await post('/auth/google/login', { credential: google(STUDENT) });
    assert.equal(g.status, 200);
    assert.ok(g.body.token);
    assert.equal(g.body.redirect, undefined);
  });

  await t.test('email/password login stays gated by LEGACY_PASSWORD_LOGIN_ENABLED', async () => {
    process.env.LEGACY_PASSWORD_LOGIN_ENABLED = 'false';
    const r = await post('/auth/login/email', { email: 'student@x.az', password: PASSWORD, portal: 'student' });
    assert.equal(r.status, 410);
    const opts = await fetch(`${base}/public/auth-options`).then((x) => x.json());
    assert.equal(opts.password_login, false);
    const adminLogin = await post('/auth/login', { identifier: 'admin@x.az', password: PASSWORD, portal: 'admin' });
    assert.equal(adminLogin.status, 200, 'admin password login is never gated');
    process.env.LEGACY_PASSWORD_LOGIN_ENABLED = 'true';
  });
});
