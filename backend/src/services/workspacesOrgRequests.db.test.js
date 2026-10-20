/**
 * «Kabinetlərim» + «Təşkilat yarat» on real PostgreSQL over HTTP (migration 240).
 * Isolated throwaway schema on a local database only (TEST_DATABASE_URL).
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const express = require('express');

const URL_VALUE = process.env.TEST_DATABASE_URL;
const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
const M240 = read('../models/migrations/240_organization_requests_workspaces.sql');
const R240 = read('../../scripts/sql/rollback/240_organization_requests_workspaces.rollback.sql');

const id = () => randomUUID();
const ADMIN = id();
const TEACHER = id(); // plain teacher (also holds the course panel role)
const TEACHER2 = id(); // will request an organization
const NEWBIE = id(); // onboarding as education centre
const LEGACY_OWNER = id(); // owns an organization row but has no membership row yet
const MULTI = id(); // owner of ORG_A, org_admin of ORG_B, also a teacher
const STRANGER = id();
const ORG_A = id();
const ORG_B = id();
const ORG_LEGACY = id();

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
CREATE TABLE courses (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), owner_user_id UUID REFERENCES users(id), name TEXT,
  is_organization BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE UNIQUE INDEX courses_one_org_per_owner ON courses (owner_user_id)
  WHERE COALESCE(is_organization, FALSE) = TRUE AND owner_user_id IS NOT NULL;
CREATE TABLE course_teachers (course_id UUID, instructor_user_id UUID, is_active BOOLEAN DEFAULT TRUE);
CREATE TABLE org_permissions (key TEXT PRIMARY KEY, group_name TEXT);
CREATE TABLE org_roles (key TEXT PRIMARY KEY, name_az TEXT, sort_order INT);
CREATE TABLE org_role_permissions (role_key TEXT, permission_key TEXT, PRIMARY KEY (role_key, permission_key));
CREATE TABLE org_memberships (course_id UUID REFERENCES courses(id), user_id UUID REFERENCES users(id),
  role_key TEXT NOT NULL REFERENCES org_roles(key), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (course_id, user_id));
CREATE TABLE org_audit_events (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), course_id UUID, actor_user_id UUID,
  action TEXT, target_type TEXT, target_id TEXT, metadata JSONB, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE partners (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID UNIQUE, status TEXT);
CREATE TABLE platform_feature_flags (key TEXT PRIMARY KEY, enabled BOOLEAN);
INSERT INTO platform_feature_flags VALUES ('access.teacher_role_approval.enabled', TRUE);
CREATE TABLE auth_events (id BIGSERIAL PRIMARY KEY, user_id UUID, event TEXT NOT NULL CHECK (event IN (
  'google_sign_in','google_sign_up','account_link_offered','account_linked','account_link_declined',
  'login_failed','legacy_login_blocked','account_switch','role_request','role_request_approved','role_request_rejected')),
  google_sub TEXT, email TEXT, ip TEXT, user_agent TEXT, metadata JSONB);
CREATE TABLE schema_migrations (filename TEXT PRIMARY KEY);
`;

test('workspaces + organization requests on real PostgreSQL', { skip: !URL_VALUE && 'TEST_DATABASE_URL not set' }, async (t) => {
  const url = new URL(URL_VALUE);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'Refusing a non-local database');
  const schema = `ws_${randomUUID().replaceAll('-', '')}`;
  const admin = new Pool({ connectionString: URL_VALUE, ssl: false });
  await admin.query(`CREATE SCHEMA ${schema}`);
  const pool = new Pool({ connectionString: URL_VALUE, options: `-c search_path=${schema},pg_catalog,public`, ssl: false, max: 20 });

  const env = { ...process.env };
  process.env.GOOGLE_CLIENT_ID = 'test-client';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'workspace-test-secret-workspace-test-123';
  const { OAuth2Client } = require('google-auth-library');
  const originalVerify = OAuth2Client.prototype.verifyIdToken;
  OAuth2Client.prototype.verifyIdToken = async ({ idToken }) => ({ getPayload: () => JSON.parse(idToken) });

  const notif = require('./notificationService');
  const originalNotif = { notifyAdmins: notif.notifyAdmins, createNotificationSafe: notif.createNotificationSafe };
  const sent = [];
  notif.notifyAdmins = async (p) => (sent.push({ to: 'admins', ...p }), { recipients: 1, created: 1 });
  notif.createNotificationSafe = async (p) => (sent.push(p), { created: true });

  const globalDb = require('../utils/db');
  const original = { query: globalDb.query, transaction: globalDb.transaction };
  globalDb.query = (...a) => pool.query(...a);
  const tx = async (fn) => {
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
  globalDb.transaction = tx;

  // Authenticated routes: x-test-user header stands in for the JWT; the active role is read from the DB
  // exactly as middleware/auth.js does.
  const auth = require('../middleware/auth');
  const originalAuth = auth.authenticate;
  auth.authenticate = async (req, res, next) => {
    const uid = req.get('x-test-user');
    const { rows } = await pool.query('SELECT id, role FROM users WHERE id = $1', [uid]);
    if (!rows[0]) return res.status(401).json({ success: false });
    req.user = { id: rows[0].id, role: rows[0].role };
    return next();
  };
  for (const r of ['../routes/auth', '../routes/organizationRequests', '../routes/course']) delete require.cache[require.resolve(r)];
  const app = express();
  app.use(express.json());
  app.use('/api/auth', require('../routes/auth'));
  app.use('/api/organization-requests', require('../routes/organizationRequests'));
  app.use('/api/course', require('../routes/course'));
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    auth.authenticate = originalAuth;
    for (const r of ['../routes/auth', '../routes/organizationRequests', '../routes/course']) delete require.cache[require.resolve(r)];
    OAuth2Client.prototype.verifyIdToken = originalVerify;
    Object.assign(notif, originalNotif);
    globalDb.query = original.query;
    globalDb.transaction = original.transaction;
    process.env = env;
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  });

  await pool.query(FIXTURE);
  const people = [
    [ADMIN, 'admin', null],
    [TEACHER, 'instructor', 'teacher'],
    [TEACHER2, 'instructor', 'teacher'],
    [NEWBIE, 'student', null],
    [LEGACY_OWNER, 'course', 'education_center'],
    [MULTI, 'instructor', 'teacher'],
    [STRANGER, 'student', 'student'],
  ];
  for (const [uid, role, persona] of people) {
    await pool.query(
      `INSERT INTO users (id, email, role, persona, google_sub, onboarding_completed) VALUES ($1,$2,$3,$4,$5,$6)`,
      [uid, `${uid.slice(0, 8)}@x.az`, role, persona, `g-${uid}`, persona != null || role === 'admin'],
    );
  }
  await pool.query(
    `INSERT INTO user_roles (user_id, role) VALUES ($1,'instructor'),($1,'course'),($2,'instructor'),($2,'course'),($3,'instructor'),($3,'course'),($4,'student')`,
    [TEACHER, TEACHER2, MULTI, STRANGER],
  );
  await pool.query(`INSERT INTO instructor_profiles (user_id) VALUES ($1),($2),($3)`, [TEACHER, TEACHER2, MULTI]);
  await pool.query(`INSERT INTO student_profiles (user_id) VALUES ($1)`, [STRANGER]);
  await pool.query(`INSERT INTO org_roles (key) VALUES ('org_admin'),('manager'),('instructor'),('viewer')`);
  await pool.query(`INSERT INTO courses (id, owner_user_id, name, is_organization) VALUES ($1,$2,'Akademiya A',TRUE),($3,$4,'Mərkəz B',TRUE),($5,$6,'Köhnə mərkəz',TRUE)`,
    [ORG_A, MULTI, ORG_B, STRANGER, ORG_LEGACY, LEGACY_OWNER]);

  const migrate = () => tx(async (c) => {
    await c.query(M240);
    await c.query(`INSERT INTO schema_migrations VALUES ('240_organization_requests_workspaces.sql') ON CONFLICT DO NOTHING`);
  });
  await migrate();
  await migrate(); // idempotent
  await pool.query(`INSERT INTO org_memberships (course_id, user_id, role_key) VALUES ($1,$2,'org_admin')`, [ORG_B, MULTI]);

  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = async (method, p, user, body) => {
    const r = await fetch(base + p, {
      method,
      headers: { 'content-type': 'application/json', ...(user ? { 'x-test-user': user } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  const google = (uid) => JSON.stringify({ sub: `g-${uid}`, email: `${uid.slice(0, 8)}@x.az`, email_verified: true });
  const orgCount = async () => (await pool.query(`SELECT COUNT(*)::int AS n FROM courses WHERE is_organization`)).rows[0].n;

  await t.test('6. migration backfills owner memberships for existing organizations', async () => {
    const { rows } = await pool.query(`SELECT course_id, role_key FROM org_memberships WHERE user_id = $1`, [LEGACY_OWNER]);
    assert.deepEqual(rows.map((r) => [r.course_id, r.role_key]), [[ORG_LEGACY, 'owner']]);
    const r = await call('POST', '/auth/google/login', null, { credential: google(LEGACY_OWNER), portal: 'organization' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.redirect, '/org');
  });

  await t.test('1. a plain teacher cannot enter or create an organization implicitly', async () => {
    const before = await orgCount();
    assert.equal((await call('POST', '/auth/google/login', null, { credential: google(TEACHER), portal: 'organization' })).status, 403);
    const sw = await call('POST', '/auth/switch-workspace', TEACHER, { target: 'course' });
    assert.equal(sw.status, 403);
    assert.equal(sw.body.code, 'ORG_REQUIRED');
    // Even with the active role forced to 'course', the /course API refuses and creates nothing.
    await pool.query(`UPDATE users SET role = 'course' WHERE id = $1`, [TEACHER]);
    const me = await call('GET', '/course/me', TEACHER);
    assert.equal(me.status, 403);
    assert.equal(me.body.code, 'ORG_REQUIRED');
    const { getOrgWorkspace } = require('./courseOrgService');
    await assert.rejects(getOrgWorkspace(TEACHER), (e) => e.code === 'ORG_REQUIRED');
    assert.equal(await orgCount(), before, 'no organization was created');
    await pool.query(`UPDATE users SET role = 'instructor' WHERE id = $1`, [TEACHER]);
  });

  await t.test('2. onboarding as education centre creates a request; approval opens the organization cabinet', async () => {
    await pool.query(`UPDATE users SET onboarding_completed = FALSE, persona = NULL WHERE id = $1`, [NEWBIE]);
    const r = await call('POST', '/auth/onboarding/persona', NEWBIE, {
      persona: 'education_center',
      profile: { center_name: 'Gələcək Akademiyası', teacher_count: '1-3', student_count: '1-20', exam_purpose: 'Buraxılış' },
    });
    assert.equal(r.status, 202, JSON.stringify(r.body));
    assert.equal(r.body.code, 'ORG_REQUEST_PENDING');
    assert.equal(r.body.organization_request.name, 'Gələcək Akademiyası');
    assert.equal(r.body.organization_request.source, 'onboarding');
    assert.equal((await call('POST', '/auth/google/login', null, { credential: google(NEWBIE), portal: 'organization' })).status, 403);
    const ok = await call('POST', `/organization-requests/${r.body.organization_request.id}/approve`, ADMIN, {});
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    const login = await call('POST', '/auth/google/login', null, { credential: google(NEWBIE), portal: 'organization' });
    assert.equal(login.status, 200, 'no second request needed');
    assert.equal(login.body.redirect, '/org');
    assert.ok(sent.some((n) => n.eventType === 'organization_request_approved' && n.recipientId === NEWBIE));
  });

  let teacher2Request;
  await t.test('3+5. a teacher requests an organization; only after approval may open it, and both cabinets', async () => {
    const created = await call('POST', '/organization-requests', TEACHER2, { name: 'Riyaziyyat Mərkəzi', org_type: 'education_center', description: 'Kurslar' });
    assert.equal(created.status, 201);
    teacher2Request = created.body.request;
    assert.equal((await call('POST', '/auth/google/login', null, { credential: google(TEACHER2), portal: 'organization' })).status, 403);
    const ws = await call('GET', '/auth/workspaces', TEACHER2);
    const createAction = ws.body.actions.find((a) => a.key === 'create_organization');
    assert.equal(createAction.status, 'pending');
    const ok = await call('POST', `/organization-requests/${teacher2Request.id}/approve`, ADMIN, {});
    assert.equal(ok.status, 200);
    const org = await call('POST', '/auth/google/login', null, { credential: google(TEACHER2), portal: 'organization' });
    assert.equal(org.status, 200);
    const inst = await call('POST', '/auth/google/login', null, { credential: google(TEACHER2), portal: 'instructor' });
    assert.equal(inst.status, 200);
    const after = await call('GET', '/auth/workspaces', TEACHER2);
    assert.deepEqual(after.body.cabinets.map((c) => c.type).sort(), ['organization', 'teacher']);
    assert.equal(after.body.actions.find((a) => a.key === 'create_organization'), undefined);
  });

  await t.test('4. parallel requests and approvals never duplicate; existing organization blocks a new one', async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => call('POST', '/organization-requests', TEACHER, { name: 'Paralel', org_type: 'school' })));
    const ids = new Set(results.map((r) => r.body.request.id));
    assert.equal(ids.size, 1);
    assert.equal(results.filter((r) => r.status === 201).length, 1);
    const [reqId] = ids;
    const before = await orgCount();
    const approvals = await Promise.all([1, 2].map(() => call('POST', `/organization-requests/${reqId}/approve`, ADMIN, {})));
    assert.deepEqual(approvals.map((a) => a.status).sort(), [200, 409]);
    assert.equal(await orgCount(), before + 1);
    assert.equal((await call('POST', `/organization-requests/${reqId}/approve`, ADMIN, {})).status, 409);
    const again = await call('POST', '/organization-requests', TEACHER, { name: 'İkinci', org_type: 'school' });
    assert.equal(again.status, 409);
    assert.equal(again.body.code, 'ALREADY_HAS_ORGANIZATION');
  });

  await t.test('7+9. other people’s organizations and forged data are refused', async () => {
    const sw = await call('POST', '/auth/switch-workspace', TEACHER2, { target: 'organization', organization_id: ORG_A });
    assert.equal(sw.status, 403);
    assert.equal((await call('GET', '/organization-requests', TEACHER2)).status, 403, 'only platform admins review');
    const fake = await call('POST', '/organization-requests', STRANGER, { name: 'Xəzər', org_type: 'school' });
    assert.equal(fake.status, 409, 'STRANGER already owns ORG_B');
    const bad = await call('POST', '/organization-requests', TEACHER2, { name: 'Y', org_type: 'bank' });
    assert.ok([400, 409].includes(bad.status));
    // Persona alone (no approved request) never yields ownership.
    const FRESH = randomUUID();
    await pool.query(`INSERT INTO users (id, email, role, persona) VALUES ($1,'fresh@x.az','instructor','education_center')`, [FRESH]);
    await pool.query(`INSERT INTO user_roles (user_id, role) VALUES ($1,'instructor'),($1,'course')`, [FRESH]);
    await pool.query(`INSERT INTO instructor_profiles (user_id) VALUES ($1)`, [FRESH]);
    const before = await orgCount();
    const forged = await call('POST', '/auth/switch-workspace', FRESH, { target: 'course' });
    assert.equal(forged.status, 403, JSON.stringify(forged.body));
    assert.equal(forged.body.code, 'ORG_REQUIRED');
    const forgedOrg = await call('POST', '/auth/switch-workspace', FRESH, { target: 'organization', organization_id: ORG_LEGACY });
    assert.equal(forgedOrg.status, 403);
    assert.equal(await orgCount(), before);
    const owner = await pool.query(`SELECT COUNT(*)::int AS n FROM org_memberships WHERE user_id = $1`, [FRESH]);
    assert.equal(owner.rows[0].n, 0);
    // Self-approval is impossible even for a platform admin.
    await pool.query(`INSERT INTO organization_requests (user_id, name, org_type) VALUES ($1,'Admin mərkəzi','other')`, [ADMIN]);
    const own = await pool.query(`SELECT id FROM organization_requests WHERE user_id = $1`, [ADMIN]);
    assert.equal((await call('POST', `/organization-requests/${own.rows[0].id}/approve`, ADMIN, {})).status, 403);
  });

  await t.test('8+7. multi-organization user: list, switch, isolation', async () => {
    const ws = await call('GET', '/auth/workspaces', MULTI);
    const orgs = ws.body.cabinets.filter((c) => c.type === 'organization');
    assert.deepEqual(orgs.map((o) => [o.organization_id, o.role_key]), [[ORG_A, 'owner'], [ORG_B, 'org_admin']]);
    assert.ok(ws.body.cabinets.some((c) => c.type === 'teacher'));
    assert.equal(ws.body.cabinets.some((c) => c.type === 'partner'), false, 'no partner record → no partner cabinet');

    const toB = await call('POST', '/auth/switch-workspace', MULTI, { target: 'organization', organization_id: ORG_B });
    assert.equal(toB.status, 200, JSON.stringify(toB.body));
    const { getOrgWorkspace } = require('./courseOrgService');
    assert.equal(String((await getOrgWorkspace(MULTI)).course.id), ORG_B);
    const wsB = await call('GET', '/auth/workspaces', MULTI);
    assert.deepEqual(wsB.body.active, { cabinet: 'organization', organization_id: ORG_B });
    const toA = await call('POST', '/auth/switch-workspace', MULTI, { target: 'organization', organization_id: ORG_A });
    assert.equal(toA.status, 200);
    assert.equal(String((await getOrgWorkspace(MULTI)).course.id), ORG_A);
    const toTeacher = await call('POST', '/auth/switch-workspace', MULTI, { target: 'teacher' });
    assert.equal(toTeacher.status, 200);
    assert.equal(toTeacher.body.user.role, 'instructor');

    await pool.query(`INSERT INTO partners (user_id, status) VALUES ($1, 'pending')`, [MULTI]);
    const withPartner = await call('GET', '/auth/workspaces', MULTI);
    assert.equal(withPartner.body.cabinets.find((c) => c.type === 'partner').status, 'pending');
  });

  await t.test('workspaces: student-only account sees only its cabinet + request actions', async () => {
    const ws = await call('GET', '/auth/workspaces', STRANGER);
    assert.deepEqual(ws.body.cabinets.map((c) => c.type), ['student', 'organization']);
    assert.deepEqual(ws.body.actions.map((a) => a.key), ['request_teacher']);
    const adminWs = await call('GET', '/auth/workspaces', ADMIN);
    assert.deepEqual(adminWs.body.cabinets.map((c) => c.type), ['admin']);
  });

  await t.test('rollback keeps organizations and owners; re-apply works', async () => {
    const orgsBefore = await orgCount();
    await pool.query(R240);
    assert.equal((await pool.query(`SELECT to_regclass('organization_requests') AS t`)).rows[0].t, null);
    assert.equal(await orgCount(), orgsBefore);
    const owners = await pool.query(`SELECT COUNT(*)::int AS n FROM org_memberships WHERE role_key = 'owner'`);
    assert.ok(owners.rows[0].n >= 4);
    await migrate();
    assert.ok((await pool.query(`SELECT to_regclass('organization_requests') AS t`)).rows[0].t);
  });
});
