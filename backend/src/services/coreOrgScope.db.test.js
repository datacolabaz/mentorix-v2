/**
 * Real PostgreSQL contracts for migrations 238/239 and the access layer:
 * idempotent apply, rollback + re-apply, backfill rule, user–group view, topic tree and group–subject guards,
 * cross-organization isolation through scopeFilter, and backend role checks over HTTP.
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
const M238 = read('../models/migrations/238_core_organization_scope.sql');
const M239 = read('../models/migrations/239_core_relations.sql');
const R238 = read('../../scripts/sql/rollback/238_core_organization_scope.rollback.sql');
const R239 = read('../../scripts/sql/rollback/239_core_relations.rollback.sql');

const id = () => randomUUID();
const ADMIN = id();
const T_SOLO = id(); // instructor of exactly one organization → groups backfilled
const T_MULTI = id(); // instructor of two organizations → untouched
const T_PERSONAL = id(); // no organization
const ORG_ADMIN_A = id();
const VIEWER_B = id();
const STUDENT = id();
const ORG_A = id();
const ORG_B = id();
const PLAIN_COURSE = id(); // a non-organization course

const FIXTURE = `
CREATE TABLE users (id UUID PRIMARY KEY, full_name TEXT DEFAULT 'U', role TEXT NOT NULL, is_active BOOLEAN DEFAULT TRUE,
  deleted_at TIMESTAMPTZ, persona TEXT, role_selected BOOLEAN DEFAULT TRUE, onboarding_completed BOOLEAN DEFAULT TRUE);
CREATE TABLE user_roles (user_id UUID, role TEXT, is_active BOOLEAN DEFAULT TRUE, UNIQUE (user_id, role));
CREATE TABLE instructor_profiles (user_id UUID UNIQUE);
CREATE TABLE course_profiles (user_id UUID UNIQUE, course_name TEXT, updated_at TIMESTAMPTZ);
CREATE TABLE student_profiles (user_id UUID UNIQUE, parent_id UUID);
CREATE TABLE courses (id UUID PRIMARY KEY, owner_user_id UUID, name TEXT, is_organization BOOLEAN DEFAULT FALSE);
CREATE TABLE org_roles (key TEXT PRIMARY KEY);
CREATE TABLE org_memberships (course_id UUID REFERENCES courses(id), user_id UUID REFERENCES users(id),
  role_key TEXT REFERENCES org_roles(key), PRIMARY KEY (course_id, user_id));
CREATE TABLE course_teachers (course_id UUID REFERENCES courses(id), instructor_user_id UUID, is_active BOOLEAN DEFAULT TRUE,
  PRIMARY KEY (course_id, instructor_user_id));
CREATE TABLE instructor_subjects (id UUID PRIMARY KEY, instructor_id UUID REFERENCES users(id), name TEXT);
CREATE TABLE instructor_groups (id UUID PRIMARY KEY, instructor_id UUID REFERENCES users(id), subject_id UUID REFERENCES instructor_subjects(id), name TEXT);
CREATE TABLE question_bank_topics (id UUID PRIMARY KEY, subject_id UUID, created_by UUID, parent_topic_id UUID REFERENCES question_bank_topics(id), name TEXT);
CREATE TABLE bank_questions (id UUID PRIMARY KEY, created_by UUID, subject_id UUID, question_text TEXT);
CREATE TABLE exams (id UUID PRIMARY KEY, instructor_id UUID, title TEXT);
CREATE TABLE course_materials (id UUID PRIMARY KEY, instructor_id UUID, title TEXT);
CREATE TABLE assignments (id UUID PRIMARY KEY, instructor_id UUID, title TEXT);
CREATE TABLE instructor_group_members (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), instructor_id UUID, student_id UUID,
  group_id UUID REFERENCES instructor_groups(id), joined_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE enrollments (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), instructor_id UUID, student_id UUID, group_id UUID,
  status TEXT, deleted_at TIMESTAMPTZ, enrolled_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE platform_feature_flags (key TEXT PRIMARY KEY, enabled BOOLEAN);
CREATE TABLE schema_migrations (filename TEXT PRIMARY KEY);
`;

test('core organization scope on real PostgreSQL', { skip: !URL_VALUE && 'TEST_DATABASE_URL not set' }, async (t) => {
  const url = new URL(URL_VALUE);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'Refusing a non-local database');
  const schema = `core_scope_${randomUUID().replaceAll('-', '')}`;
  const admin = new Pool({ connectionString: URL_VALUE, ssl: false });
  await admin.query(`CREATE SCHEMA ${schema}`);
  const pool = new Pool({ connectionString: URL_VALUE, options: `-c search_path=${schema},pg_catalog,public`, ssl: false, max: 10 });
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
  t.after(async () => {
    globalDb.query = original.query;
    globalDb.transaction = original.transaction;
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  });

  // Like scripts/migrate.js: each migration in its own transaction, recorded in schema_migrations.
  const migrate = async () => {
    for (const [file, sql] of [['238_core_organization_scope.sql', M238], ['239_core_relations.sql', M239]]) {
      await tx(async (c) => {
        await c.query(sql);
        await c.query('INSERT INTO schema_migrations VALUES ($1) ON CONFLICT DO NOTHING', [file]);
      });
    }
  };

  await pool.query(FIXTURE);
  for (const [uid, role] of [[ADMIN, 'admin'], [T_SOLO, 'instructor'], [T_MULTI, 'instructor'], [T_PERSONAL, 'instructor'],
    [ORG_ADMIN_A, 'course'], [VIEWER_B, 'instructor'], [STUDENT, 'student']]) {
    await pool.query('INSERT INTO users (id, role) VALUES ($1,$2)', [uid, role]);
  }
  await pool.query(`INSERT INTO user_roles (user_id, role) VALUES ($1,'instructor'),($2,'instructor'),($3,'instructor'),($4,'student')`, [T_SOLO, T_MULTI, T_PERSONAL, STUDENT]);
  await pool.query(`INSERT INTO courses VALUES ($1,$4,'A',TRUE),($2,$5,'B',TRUE),($3,$6,'Plain',FALSE)`, [ORG_A, ORG_B, PLAIN_COURSE, ORG_ADMIN_A, VIEWER_B, T_PERSONAL]);
  await pool.query(`INSERT INTO org_roles VALUES ('owner'),('org_admin'),('manager'),('instructor'),('viewer')`);
  await pool.query(
    `INSERT INTO org_memberships VALUES ($1,$3,'instructor'),($1,$4,'instructor'),($2,$4,'instructor'),($1,$5,'org_admin'),($2,$6,'viewer')`,
    [ORG_A, ORG_B, T_SOLO, T_MULTI, ORG_ADMIN_A, VIEWER_B],
  );
  // course_teachers of a NON-organization course must not count.
  await pool.query(`INSERT INTO course_teachers VALUES ($1,$2,TRUE)`, [PLAIN_COURSE, T_PERSONAL]);

  const subj = { solo: id(), multi: id(), personal: id() };
  await pool.query(`INSERT INTO instructor_subjects VALUES ($1,$4,'Riyaziyyat'),($2,$5,'Fizika'),($3,$6,'Kimya')`,
    [subj.solo, subj.multi, subj.personal, T_SOLO, T_MULTI, T_PERSONAL]);
  const grp = { solo: id(), soloPreset: id(), multi: id(), personal: id() };
  await pool.query(`INSERT INTO instructor_groups VALUES ($1,$5,$6,'S1'),($2,$5,$6,'S2'),($3,$7,$8,'M1'),($4,$9,$10,'P1')`,
    [grp.solo, grp.soloPreset, grp.multi, grp.personal, T_SOLO, subj.solo, T_MULTI, subj.multi, T_PERSONAL, subj.personal]);

  await t.test('migrations apply, are idempotent, and keep existing rows', async () => {
    await migrate();
    await migrate();
    for (const table of ['instructor_subjects', 'instructor_groups', 'question_bank_topics', 'bank_questions', 'exams', 'course_materials', 'assignments']) {
      const { rows } = await pool.query(
        `SELECT is_nullable FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 AND column_name = 'organization_id'`,
        [schema, table],
      );
      assert.equal(rows[0]?.is_nullable, 'YES', table);
    }
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM instructor_groups');
    assert.equal(rows[0].n, 4);
  });

  await t.test('backfill: only the single-organization teacher’s groups get an organization', async () => {
    const { rows } = await pool.query('SELECT id, organization_id FROM instructor_groups');
    const org = Object.fromEntries(rows.map((r) => [r.id, r.organization_id]));
    assert.equal(org[grp.solo], ORG_A);
    assert.equal(org[grp.soloPreset], ORG_A);
    assert.equal(org[grp.multi], null, 'teacher in two organizations stays personal');
    assert.equal(org[grp.personal], null, 'non-organization course does not count');
    const { rows: subjects } = await pool.query('SELECT COUNT(*)::int AS n FROM instructor_subjects WHERE organization_id IS NOT NULL');
    assert.equal(subjects[0].n, 0, 'subjects are not backfilled');
  });

  await t.test('FK: organization_id must reference an existing course', async () => {
    await pool.query(`INSERT INTO exams VALUES ($1,$2,'E')`, [id(), T_SOLO]);
    await assert.rejects(pool.query('UPDATE exams SET organization_id = $1', [id()]), /violates foreign key/);
    await pool.query('UPDATE exams SET organization_id = $1', [ORG_A]);
    await pool.query('UPDATE exams SET organization_id = NULL');
  });

  await t.test('user–group view: members + current enrollments, with group organization', async () => {
    await pool.query(`INSERT INTO instructor_group_members (instructor_id, student_id, group_id) VALUES ($1,$2,$3)`, [T_SOLO, STUDENT, grp.solo]);
    await pool.query(`INSERT INTO enrollments (instructor_id, student_id, group_id, status) VALUES ($1,$2,$3,'active'),($4,$2,$5,'left')`,
      [T_SOLO, STUDENT, grp.soloPreset, T_MULTI, grp.multi]);
    const { rows } = await pool.query(`SELECT group_id, source, organization_id FROM group_memberships_v WHERE user_id = $1 ORDER BY source`, [STUDENT]);
    assert.deepEqual(rows.map((r) => [r.group_id, r.source, r.organization_id]), [
      [grp.soloPreset, 'enrollment', ORG_A],
      [grp.solo, 'member', ORG_A],
    ]);
  });

  await t.test('topic tree: parent support, depth ≤ 5, no cycles, same organization', async () => {
    const ids = Array.from({ length: 6 }, () => id());
    await pool.query(`INSERT INTO question_bank_topics (id, subject_id, created_by, name) VALUES ($1,$2,$3,'L1')`, [ids[0], subj.solo, T_SOLO]);
    for (let i = 1; i < 5; i += 1) {
      await pool.query(`INSERT INTO question_bank_topics (id, subject_id, created_by, parent_topic_id, name) VALUES ($1,$2,$3,$4,$5)`,
        [ids[i], subj.solo, T_SOLO, ids[i - 1], `L${i + 1}`]);
    }
    await assert.rejects(
      pool.query(`INSERT INTO question_bank_topics (id, subject_id, created_by, parent_topic_id, name) VALUES ($1,$2,$3,$4,'L6')`, [ids[5], subj.solo, T_SOLO, ids[4]]),
      /deeper than 5/,
    );
    await assert.rejects(pool.query(`UPDATE question_bank_topics SET parent_topic_id = $1 WHERE id = $2`, [ids[2], ids[0]]), /cycle/);
    const orgTopic = id();
    await pool.query(`INSERT INTO question_bank_topics (id, subject_id, created_by, name, organization_id) VALUES ($1,$2,$3,'Org',$4)`, [orgTopic, subj.solo, T_SOLO, ORG_A]);
    await assert.rejects(
      pool.query(`INSERT INTO question_bank_topics (id, subject_id, created_by, parent_topic_id, name) VALUES ($1,$2,$3,$4,'Personal child')`, [id(), subj.solo, T_SOLO, orgTopic]),
      /another organization/,
    );
  });

  await t.test('group–subject: organization group cannot use another organization’s subject', async () => {
    await pool.query('UPDATE instructor_subjects SET organization_id = $1 WHERE id = $2', [ORG_B, subj.multi]);
    await assert.rejects(pool.query('UPDATE instructor_groups SET organization_id = $1 WHERE id = $2', [ORG_A, grp.multi]), /another organization/);
    await pool.query('UPDATE instructor_groups SET organization_id = $1 WHERE id = $2', [ORG_B, grp.multi]);
    // personal subject in an organization group is allowed
    await pool.query('UPDATE instructor_groups SET organization_id = $1 WHERE id = $2', [ORG_A, grp.personal]);
    await pool.query('UPDATE instructor_groups SET organization_id = NULL WHERE id = $1', [grp.personal]);
  });

  const scopeSvc = require('./accessScope');
  const visibleGroups = async (userId, permission = 'groups.view') => {
    const scope = await scopeSvc.loadUserScope(userId);
    const params = [];
    const where = scopeSvc.scopeFilter(scope, { table: 'instructor_groups', alias: 'g', permission, params });
    const { rows } = await pool.query(`SELECT g.name FROM instructor_groups g WHERE ${where} ORDER BY g.name`, params);
    return rows.map((r) => r.name);
  };

  await t.test('isolation: each caller sees own rows + rows of orgs where their role allows it', async () => {
    assert.deepEqual(await visibleGroups(T_PERSONAL), ['P1']);
    assert.deepEqual(await visibleGroups(T_SOLO), ['S1', 'S2'], 'instructor role has groups.view in A — sees only A rows + own');
    assert.deepEqual(await visibleGroups(ORG_ADMIN_A), ['S1', 'S2']);
    assert.deepEqual(await visibleGroups(VIEWER_B), ['M1'], 'viewer of B sees B groups only');
    assert.deepEqual(await visibleGroups(VIEWER_B, 'groups.edit'), [], 'viewer has no edit permission');
    assert.deepEqual(await visibleGroups(ADMIN), ['M1', 'P1', 'S1', 'S2']);
    assert.deepEqual(await visibleGroups(STUDENT), []);
  });

  await t.test('writable organization: must exist, be an organization and grant the permission', async () => {
    const scope = await scopeSvc.loadUserScope(ORG_ADMIN_A);
    assert.equal(await scopeSvc.resolveWritableOrganization(scope, null, 'groups.create'), null);
    assert.equal(await scopeSvc.resolveWritableOrganization(scope, ORG_A, 'groups.create'), ORG_A);
    await assert.rejects(scopeSvc.resolveWritableOrganization(scope, ORG_B, 'groups.create'), (e) => e.statusCode === 403);
    await assert.rejects(scopeSvc.resolveWritableOrganization(scope, PLAIN_COURSE, 'groups.create'), (e) => e.statusCode === 404);
    const viewer = await scopeSvc.loadUserScope(VIEWER_B);
    await assert.rejects(scopeSvc.resolveWritableOrganization(viewer, ORG_B, 'groups.create'), (e) => e.code === 'ORG_PERMISSION_REQUIRED');
  });

  await t.test('HTTP: backend role and org-permission checks', async (tt) => {
    const { requireAccess, requireOrgPermission } = require('../middleware/access');
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.user = { id: req.get('x-user') };
      next();
    });
    app.get('/teacher-only', requireAccess('teacher'), (_req, res) => res.json({ ok: true }));
    app.get('/orgs/:orgId/groups', requireOrgPermission('groups.view'), (req, res) => res.json({ org: req.organizationId }));
    app.post('/orgs/:orgId/groups', requireOrgPermission('groups.create'), (_req, res) => res.json({ ok: true }));
    const server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    tt.after(() => new Promise((resolve) => server.close(resolve)));
    const call = async (method, p, user) => {
      const r = await fetch(`http://127.0.0.1:${server.address().port}${p}`, { method, headers: { 'x-user': user } });
      return { status: r.status, body: await r.json() };
    };
    assert.equal((await call('GET', '/teacher-only', T_SOLO)).status, 200);
    const denied = await call('GET', '/teacher-only', STUDENT);
    assert.equal(denied.status, 403);
    assert.equal(denied.body.code, 'ACCESS_ROLE_REQUIRED');
    assert.equal((await call('GET', '/teacher-only', ADMIN)).status, 200, 'super_admin passes');
    assert.equal((await call('GET', `/orgs/${ORG_A}/groups`, T_SOLO)).status, 200);
    assert.equal((await call('POST', `/orgs/${ORG_A}/groups`, T_SOLO)).status, 403, 'instructor cannot create org groups');
    assert.equal((await call('POST', `/orgs/${ORG_A}/groups`, ORG_ADMIN_A)).status, 200);
    assert.equal((await call('GET', `/orgs/${ORG_A}/groups`, VIEWER_B)).status, 403, 'member of B gets nothing in A');
    assert.equal((await call('GET', '/teacher-only', 'not-a-uuid')).status, 401);
  });

  await t.test('rollback 239 → 238 restores the original tables; migrations re-apply cleanly', async () => {
    await pool.query(R239);
    await pool.query(R238);
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM information_schema.columns WHERE table_schema = $1 AND column_name = 'organization_id'`,
      [schema],
    );
    assert.equal(rows[0].n, 0);
    const view = await pool.query(`SELECT to_regclass($1) AS v`, [`${schema}.group_memberships_v`]);
    assert.equal(view.rows[0].v, null);
    const applied = await pool.query('SELECT filename FROM schema_migrations');
    assert.deepEqual(applied.rows, []);
    const groups = await pool.query('SELECT COUNT(*)::int AS n FROM instructor_groups');
    assert.equal(groups.rows[0].n, 4, 'rows kept');
    await migrate();
    const again = await pool.query('SELECT organization_id FROM instructor_groups WHERE id = $1', [grp.solo]);
    assert.equal(again.rows[0].organization_id, ORG_A);
  });
});
