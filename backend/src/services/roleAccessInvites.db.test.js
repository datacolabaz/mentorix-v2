/**
 * Real PostgreSQL contracts for migration 237: teacher-role approval, invite token limits under
 * concurrency, single use per user, rollback of failed joins, and the join log.
 * Runs only against a local database in an isolated throwaway schema (TEST_DATABASE_URL).
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const express = require('express');

const URL_VALUE = process.env.TEST_DATABASE_URL;
const MIGRATION = fs.readFileSync(path.join(__dirname, '../models/migrations/237_role_access_invites_live_topics.sql'), 'utf8');

const ADMIN = randomUUID();
const TEACHER = randomUUID();
const ORG_OWNER = randomUUID();
const OTHER_ORG_OWNER = randomUUID();
const APPLICANT = randomUUID();
const ORG_APPLICANT = randomUUID();
const STUDENTS = Array.from({ length: 12 }, () => randomUUID());
const GROUP = randomUUID();
const OTHER_GROUP = randomUUID();
const ORG = randomUUID();
const OTHER_ORG = randomUUID();

const FIXTURE = `
CREATE FUNCTION uuid_generate_v4() RETURNS UUID LANGUAGE sql AS $$ SELECT gen_random_uuid() $$;
CREATE TABLE users (
  id UUID PRIMARY KEY, full_name TEXT NOT NULL DEFAULT 'User', email TEXT, role TEXT NOT NULL DEFAULT 'student',
  is_active BOOLEAN DEFAULT TRUE, deleted_at TIMESTAMPTZ, persona TEXT, persona_profile JSONB DEFAULT '{}'::jsonb,
  role_selected BOOLEAN DEFAULT TRUE, onboarding_completed BOOLEAN DEFAULT TRUE, created_at TIMESTAMPTZ DEFAULT NOW(),
  phone TEXT, phone_verified BOOLEAN DEFAULT FALSE, is_verified BOOLEAN DEFAULT TRUE, account_status TEXT DEFAULT 'active',
  google_sub TEXT, auth_provider TEXT
);
CREATE TABLE user_roles (user_id UUID REFERENCES users(id), role TEXT, is_active BOOLEAN DEFAULT TRUE, UNIQUE (user_id, role));
CREATE TABLE instructor_profiles (user_id UUID UNIQUE REFERENCES users(id), subject TEXT);
CREATE TABLE course_profiles (user_id UUID UNIQUE REFERENCES users(id), course_name TEXT, updated_at TIMESTAMPTZ);
CREATE TABLE student_profiles (user_id UUID UNIQUE REFERENCES users(id), parent_id UUID);
CREATE TABLE enrollments (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), instructor_id UUID, student_id UUID,
  group_id UUID, status TEXT, deleted_at TIMESTAMPTZ);
CREATE TABLE courses (id UUID PRIMARY KEY, owner_user_id UUID UNIQUE REFERENCES users(id), name TEXT, is_organization BOOLEAN DEFAULT FALSE);
CREATE TABLE org_permissions (key TEXT PRIMARY KEY, group_name TEXT);
CREATE TABLE org_roles (key TEXT PRIMARY KEY, name_az TEXT, sort_order INT);
CREATE TABLE org_role_permissions (role_key TEXT, permission_key TEXT, PRIMARY KEY (role_key, permission_key));
CREATE TABLE org_memberships (course_id UUID REFERENCES courses(id), user_id UUID REFERENCES users(id),
  role_key TEXT NOT NULL REFERENCES org_roles(key), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (course_id, user_id));
CREATE TABLE org_audit_events (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), course_id UUID, actor_user_id UUID,
  action TEXT, target_type TEXT, target_id TEXT, metadata JSONB, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE instructor_groups (id UUID PRIMARY KEY, instructor_id UUID REFERENCES users(id), name TEXT, is_system BOOLEAN DEFAULT FALSE,
  subject_id UUID, join_code TEXT, invitation_code TEXT, invitation_link TEXT, join_code_expires_at TIMESTAMPTZ);
CREATE TABLE instructor_subjects (id UUID PRIMARY KEY, name TEXT);
CREATE TABLE live_rooms (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), room_code TEXT, instructor_id UUID REFERENCES users(id),
  group_id UUID, student_id UUID, title TEXT, description TEXT, status TEXT DEFAULT 'waiting', provider TEXT DEFAULT 'zoom',
  join_url TEXT, scheduled_at TIMESTAMPTZ, started_at TIMESTAMPTZ, ended_at TIMESTAMPTZ, ends_at TIMESTAMPTZ, duration_minutes INT,
  notify_email BOOLEAN DEFAULT TRUE, materials JSONB DEFAULT '[]'::jsonb, series_id UUID, cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE live_lesson_attendance (room_id UUID, student_id UUID, status TEXT, note TEXT, marked_at TIMESTAMPTZ);
CREATE TABLE course_materials (id UUID PRIMARY KEY, instructor_id UUID, title TEXT, original_filename TEXT);
CREATE TABLE assignments (id UUID PRIMARY KEY, instructor_id UUID, title TEXT, due_date TIMESTAMPTZ, max_score NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE exams (id UUID PRIMARY KEY, instructor_id UUID, title TEXT, is_deleted BOOLEAN DEFAULT FALSE,
  show_results BOOLEAN DEFAULT TRUE, result_visibility_mode TEXT, results_release_at TIMESTAMPTZ, available_until TIMESTAMPTZ);
CREATE TABLE exam_results (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), exam_id UUID, student_id UUID, score NUMERIC, submitted_at TIMESTAMPTZ);
CREATE TABLE exam_bank_settings (exam_id UUID);
CREATE TABLE exam_assignments (exam_id UUID, student_id UUID, UNIQUE (exam_id, student_id));
CREATE TABLE student_assignments (assignment_id UUID, student_id UUID, status TEXT, score NUMERIC, submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ, UNIQUE (assignment_id, student_id));
CREATE TABLE platform_feature_flags (key TEXT PRIMARY KEY, enabled BOOLEAN NOT NULL DEFAULT FALSE, description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(), updated_by UUID);
CREATE TABLE auth_events (id BIGSERIAL PRIMARY KEY, user_id UUID, event TEXT NOT NULL CHECK (event IN (
  'google_sign_in','google_sign_up','account_link_offered','account_linked','account_link_declined',
  'login_failed','legacy_login_blocked','account_switch')), google_sub TEXT, email TEXT, ip TEXT, user_agent TEXT, metadata JSONB);
`;

test('role approval + invite tokens on real PostgreSQL (isolated local schema)', { skip: !URL_VALUE && 'TEST_DATABASE_URL not set' }, async (t) => {
  const url = new URL(URL_VALUE);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'Refusing a non-local database');
  const schema = `rbac_inv_${randomUUID().replaceAll('-', '')}`;
  const admin = new Pool({ connectionString: URL_VALUE, ssl: false });
  await admin.query(`CREATE SCHEMA ${schema}`);
  const pool = new Pool({ connectionString: URL_VALUE, options: `-c search_path=${schema},pg_catalog,public`, ssl: false, max: 20 });

  const globalDb = require('../utils/db');
  const original = { query: globalDb.query, transaction: globalDb.transaction };
  const notif = require('./notificationService');
  const originalNotif = { notifyAdmins: notif.notifyAdmins, createNotificationSafe: notif.createNotificationSafe };
  const sent = [];
  notif.notifyAdmins = async (input) => {
    sent.push({ to: 'admins', ...input });
    return { recipients: 1, created: 1 };
  };
  notif.createNotificationSafe = async (input) => {
    sent.push(input);
    return { created: true };
  };
  globalDb.query = (...args) => pool.query(...args);
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
  t.after(async () => {
    globalDb.query = original.query;
    globalDb.transaction = original.transaction;
    Object.assign(notif, originalNotif);
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  });

  await globalDb.transaction(async (c) => {
    await c.query(FIXTURE);
  });
  // Migration runs exactly like scripts/migrate.js (one transaction) — twice, to prove it is idempotent.
  for (let i = 0; i < 2; i += 1) {
    await globalDb.transaction(async (c) => c.query(MIGRATION));
  }

  const users = [
    [ADMIN, 'Admin', 'admin', 'other'],
    [TEACHER, 'Müəllim', 'instructor', 'teacher'],
    [ORG_OWNER, 'Org sahibi', 'course', 'education_center'],
    [OTHER_ORG_OWNER, 'Digər org', 'course', 'education_center'],
    [APPLICANT, 'Namizəd', 'student', 'student'],
    [ORG_APPLICANT, 'Org namizədi', 'student', 'student'],
    ...STUDENTS.map((id, i) => [id, `Tələbə ${i}`, 'student', 'student']),
  ];
  for (const [id, name, role, persona] of users) {
    await pool.query('INSERT INTO users (id, full_name, role, persona) VALUES ($1,$2,$3,$4)', [id, name, role, persona]);
  }
  await pool.query(`INSERT INTO user_roles (user_id, role) VALUES ($1,'instructor'),($2,'student'),($3,'student')`, [TEACHER, APPLICANT, ORG_APPLICANT]);
  await pool.query(`INSERT INTO instructor_profiles (user_id) VALUES ($1)`, [TEACHER]);
  await pool.query(`INSERT INTO student_profiles (user_id) VALUES ($1),($2)`, [APPLICANT, ORG_APPLICANT]);
  await pool.query(`INSERT INTO courses VALUES ($1,$2,'Akademiya',TRUE),($3,$4,'Başqa',TRUE)`, [ORG, ORG_OWNER, OTHER_ORG, OTHER_ORG_OWNER]);
  const { syncOrgPermissionCatalog } = require('./orgRbacService');
  await syncOrgPermissionCatalog();
  await pool.query(`INSERT INTO org_memberships (course_id, user_id, role_key) VALUES ($1,$2,'owner'),($3,$4,'owner')`, [ORG, ORG_OWNER, OTHER_ORG, OTHER_ORG_OWNER]);
  await pool.query(`INSERT INTO instructor_groups VALUES ($1,$2,'Riyaziyyat A',FALSE),($3,$4,'Başqasının qrupu',FALSE)`, [GROUP, TEACHER, OTHER_GROUP, ORG_OWNER]);

  const roles = require('./roleAccessService');
  const invites = require('./groupInviteService');

  await t.test('migration seeds the approval flag ON and widens the auth event CHECK', async () => {
    const { rows } = await pool.query(`SELECT enabled FROM platform_feature_flags WHERE key='access.teacher_role_approval.enabled'`);
    assert.equal(rows[0].enabled, true);
    await pool.query(`INSERT INTO auth_events (event) VALUES ('role_request'),('role_request_approved'),('account_switch')`);
    await assert.rejects(pool.query(`INSERT INTO auth_events (event) VALUES ('made_up')`), /auth_events_event_check/);
  });

  await t.test('access roles come from grants, not from the client', async () => {
    assert.deepEqual(await roles.resolveAccessRoles(ADMIN), ['super_admin']);
    assert.deepEqual(await roles.resolveAccessRoles(TEACHER), ['teacher']);
    assert.deepEqual(await roles.resolveAccessRoles(ORG_OWNER), ['organization_admin']);
    assert.deepEqual(await roles.resolveAccessRoles(APPLICANT), ['student']);
  });

  await t.test('a student cannot enter the teacher cabinet without approval', async () => {
    assert.deepEqual(await roles.checkStorageRoleEntry(APPLICANT, 'instructor'), { allowed: false, approvalRequired: true });
    assert.deepEqual(await roles.checkStorageRoleEntry(APPLICANT, 'course'), { allowed: false, organizationRequired: true });
    assert.deepEqual(await roles.checkStorageRoleEntry(APPLICANT, 'student'), { allowed: true });
    // parent/student are never self-granted outside the first onboarding choice
    assert.deepEqual(await roles.checkStorageRoleEntry(TEACHER, 'student'), { allowed: false });
    assert.deepEqual(await roles.checkStorageRoleEntry(TEACHER, 'student', { onboarding: true }), { allowed: true });
    assert.deepEqual(await roles.checkStorageRoleEntry(TEACHER, 'instructor'), { allowed: true });
  });

  let requestId;
  await t.test('parallel teacher requests collapse into one pending request', async () => {
    const results = await Promise.all(Array.from({ length: 6 }, () => roles.requestTeacherRole(APPLICANT, { note: 'Riyaziyyat', source: 'workspace_switch' })));
    const ids = new Set(results.map((r) => r.request.id));
    assert.equal(ids.size, 1);
    assert.equal(results.filter((r) => r.created).length, 1);
    requestId = [...ids][0];
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM role_requests WHERE user_id=$1 AND status='pending'`, [APPLICANT]);
    assert.equal(rows[0].n, 1);
    assert.ok(sent.some((n) => n.to === 'admins' && n.eventType === 'role_request_created'));
  });

  await t.test('organization admins see only their organization; self-review is refused', async () => {
    await assert.rejects(roles.listRoleRequestsForReviewer(TEACHER), (e) => e.statusCode === 403);
    const own = await roles.listRoleRequestsForReviewer(ORG_OWNER);
    assert.equal(own.requests.length, 0, 'platform-level request is not visible to an org admin');
    await assert.rejects(roles.approveRoleRequest(ORG_OWNER, requestId), (e) => e.statusCode === 404);
    const all = await roles.listRoleRequestsForReviewer(ADMIN);
    assert.equal(all.scope, 'platform');
    assert.ok(all.requests.some((r) => r.id === requestId));
  });

  await t.test('platform admin approval grants the teacher membership without switching the active cabinet', async () => {
    await roles.approveRoleRequest(ADMIN, requestId);
    const { rows } = await pool.query(`SELECT role FROM users WHERE id=$1`, [APPLICANT]);
    assert.equal(rows[0].role, 'student', 'active cabinet unchanged');
    assert.deepEqual(await roles.checkStorageRoleEntry(APPLICANT, 'instructor'), { allowed: true });
    assert.ok((await roles.resolveAccessRoles(APPLICANT)).includes('teacher'));
    await assert.rejects(roles.approveRoleRequest(ADMIN, requestId), (e) => e.statusCode === 409);
    assert.equal((await roles.requestTeacherRole(APPLICANT)).status, 'already_granted');
    assert.ok(sent.some((n) => n.eventType === 'role_request_approved' && n.recipientId === APPLICANT));
  });

  await t.test('organization request: only that organization admin (or platform admin) can approve', async () => {
    const { request } = await roles.requestTeacherRole(ORG_APPLICANT, { organizationId: ORG, source: 'organization' });
    await assert.rejects(roles.approveRoleRequest(OTHER_ORG_OWNER, request.id), (e) => e.statusCode === 404);
    const list = await roles.listRoleRequestsForReviewer(ORG_OWNER);
    assert.deepEqual(list.requests.map((r) => r.id), [request.id]);
    await roles.approveRoleRequest(ORG_OWNER, request.id);
    const { rows } = await pool.query(`SELECT role_key FROM org_memberships WHERE course_id=$1 AND user_id=$2`, [ORG, ORG_APPLICANT]);
    assert.equal(rows[0].role_key, 'instructor');
    const audit = await pool.query(`SELECT action FROM org_audit_events WHERE course_id=$1`, [ORG]);
    assert.deepEqual(audit.rows.map((r) => r.action), ['teacher_role_approved']);
  });

  await t.test('rejection keeps the role closed and can be followed by a new request', async () => {
    const someone = STUDENTS[11];
    const { request } = await roles.requestTeacherRole(someone);
    await roles.rejectRoleRequest(ADMIN, request.id, { reason: 'Sənəd çatışmır' });
    assert.deepEqual(await roles.checkStorageRoleEntry(someone, 'instructor'), { allowed: false, approvalRequired: true });
    const summary = await roles.getAccessSummary(someone);
    assert.equal(summary.teacher_request.status, 'rejected');
    assert.equal(summary.teacher_request.review_reason, 'Sənəd çatışmır');
    const again = await roles.requestTeacherRole(someone);
    assert.equal(again.created, true);
  });

  await t.test('turning the flag off restores the old self-service behaviour', async () => {
    const ff = require('./featureFlagService');
    await pool.query(`UPDATE platform_feature_flags SET enabled=FALSE WHERE key='access.teacher_role_approval.enabled'`);
    ff.invalidateFeatureFlagCache();
    assert.deepEqual(await roles.checkStorageRoleEntry(STUDENTS[10], 'instructor'), { allowed: true });
    await pool.query(`UPDATE platform_feature_flags SET enabled=TRUE WHERE key='access.teacher_role_approval.enabled'`);
    ff.invalidateFeatureFlagCache();
  });

  await t.test('HTTP: cabinet switch to teacher creates a pending request instead of switching', async (tt) => {
    const auth = require('../middleware/auth');
    const originalAuth = auth.authenticate;
    auth.authenticate = async (req, res, next) => {
      const id = req.get('x-test-user');
      const { rows } = await pool.query('SELECT id, role FROM users WHERE id = $1', [id]);
      req.user = { id: rows[0].id, role: rows[0].role };
      next();
    };
    delete require.cache[require.resolve('../routes/auth')];
    const app = express();
    app.use(express.json());
    app.use('/api/auth', require('../routes/auth'));
    const server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    tt.after(async () => {
      auth.authenticate = originalAuth;
      delete require.cache[require.resolve('../routes/auth')];
      await new Promise((resolve) => server.close(resolve));
    });
    const base = `http://127.0.0.1:${server.address().port}/api/auth`;
    const call = async (method, p, user, body) => {
      const r = await fetch(base + p, { method, headers: { 'content-type': 'application/json', 'x-test-user': user }, body: JSON.stringify(body || {}) });
      return { status: r.status, body: await r.json() };
    };
    const student = STUDENTS[10];

    const sw = await call('POST', '/switch-workspace', student, { target: 'teacher' });
    assert.equal(sw.status, 202);
    assert.equal(sw.body.code, 'ROLE_APPROVAL_PENDING');
    assert.equal(sw.body.pending_approval, true);
    assert.equal(sw.body.token, undefined, 'no new session is issued');
    assert.equal(sw.body.user.teacher_request.status, 'pending');
    assert.ok(sw.body.user.access_roles.includes('student'));
    assert.ok(!sw.body.user.access_roles.includes('teacher'));

    const again = await call('PATCH', '/persona', student, { persona: 'teacher' });
    assert.equal(again.status, 202);
    // The organization cabinet needs an approved «Təşkilat yarat» request (migration 240), not a teacher request.
    const course = await call('POST', '/switch-workspace', student, { target: 'course' });
    assert.equal(course.status, 403);
    assert.equal(course.body.code, 'ORG_REQUIRED');
    const { rows } = await pool.query(`SELECT role FROM users WHERE id=$1`, [student]);
    assert.equal(rows[0].role, 'student');
    const pending = await pool.query(`SELECT COUNT(*)::int AS n FROM role_requests WHERE user_id=$1 AND status='pending'`, [student]);
    assert.equal(pending.rows[0].n, 1);

    const teacherToStudent = await call('POST', '/switch-workspace', TEACHER, { target: 'student' });
    assert.equal(teacherToStudent.status, 403);
    assert.equal(teacherToStudent.body.code, 'ROLE_NOT_GRANTED');
    const bogus = await call('POST', '/switch-workspace', TEACHER, { target: 'admin' });
    assert.equal(bogus.status, 400);
  });

  /* ------------------------------------------------------------ invites */

  /** Mirrors joinInvitationService.createJoinRequest: lock first, write the join, then record the use. */
  async function join(token, userId, { failAfterWrite = false } = {}) {
    return globalDb.transaction(async (c) => {
      const lock = await invites.lockInviteForJoin(c, token, userId);
      if (lock.alreadyRedeemed) {
        const err = new Error('already');
        err.code = 'INVITE_ALREADY_USED';
        throw err;
      }
      const { rows } = await c.query(
        `INSERT INTO enrollments (instructor_id, student_id, group_id, status) VALUES ($1,$2,$3,'pending_approval') RETURNING id`,
        [TEACHER, userId, lock.invite.group_id],
      );
      if (failAfterWrite) throw new Error('simulated failure after writes');
      await invites.recordRedemption(c, lock.invite, { userId, enrollmentId: rows[0].id, ip: '10.0.0.1', userAgent: 'test' });
      return rows[0].id;
    });
  }

  await t.test('teacher creates tokens only for own groups; inputs validated', async () => {
    await assert.rejects(invites.createInvite(TEACHER, OTHER_GROUP, { duration: '24h' }), (e) => e.statusCode === 404);
    const inv = await invites.createInvite(TEACHER, GROUP, { duration: '7d', max_uses: 30 });
    assert.equal(inv.max_uses, 30);
    assert.equal(inv.used_count, 0);
    assert.equal(inv.status, 'active');
    assert.equal(inv.allowed_role, 'student');
    const listed = await invites.listInvites(TEACHER);
    assert.ok(listed.some((i) => i.id === inv.id));
    assert.deepEqual(await invites.listInvites(ORG_OWNER), []);
  });

  await t.test('10 parallel joins on a 3-use token: exactly 3 succeed, the rest get "link no longer active"', async () => {
    const inv = await invites.createInvite(TEACHER, GROUP, { duration: '24h', max_uses: 3 });
    const results = await Promise.allSettled(STUDENTS.slice(0, 10).map((sid) => join(inv.token, sid)));
    const ok = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected');
    assert.equal(ok.length, 3);
    assert.equal(failed.length, 7);
    for (const f of failed) {
      assert.equal(f.reason.code, 'INVITE_INACTIVE');
      assert.equal(f.reason.statusCode, 410);
      assert.equal(f.reason.message, invites.INACTIVE_MESSAGE);
    }
    const { rows } = await pool.query(`SELECT used_count FROM group_invites WHERE id=$1`, [inv.id]);
    assert.equal(rows[0].used_count, 3);
    const log = await pool.query(`SELECT COUNT(*)::int AS n FROM group_invite_redemptions WHERE invite_id=$1`, [inv.id]);
    assert.equal(log.rows[0].n, 3);
    const enr = await pool.query(`SELECT COUNT(*)::int AS n FROM enrollments WHERE group_id=$1`, [GROUP]);
    assert.equal(enr.rows[0].n, 3, 'rolled-back joins leave no enrollment behind');
  });

  await t.test('the same user can use a token only once, even in parallel', async () => {
    const inv = await invites.createInvite(TEACHER, GROUP, { duration: '24h', max_uses: 30 });
    const sid = STUDENTS[0];
    const results = await Promise.allSettled([join(inv.token, sid), join(inv.token, sid), join(inv.token, sid)]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.ok(results.filter((r) => r.status === 'rejected').every((r) => ['INVITE_ALREADY_USED', '23505'].includes(r.reason.code)));
    const { rows } = await pool.query(`SELECT used_count FROM group_invites WHERE id=$1`, [inv.id]);
    assert.equal(rows[0].used_count, 1);
  });

  await t.test('a join that fails after its writes does not consume a use', async () => {
    const inv = await invites.createInvite(TEACHER, GROUP, { duration: '24h', max_uses: 1 });
    await assert.rejects(join(inv.token, STUDENTS[5], { failAfterWrite: true }), /simulated/);
    const { rows } = await pool.query(`SELECT used_count FROM group_invites WHERE id=$1`, [inv.id]);
    assert.equal(rows[0].used_count, 0);
    await join(inv.token, STUDENTS[6]);
    await assert.rejects(join(inv.token, STUDENTS[7]), (e) => e.code === 'INVITE_INACTIVE');
  });

  await t.test('revoked and expired tokens are refused with the same message; DB CHECK backs the limit', async () => {
    const inv = await invites.createInvite(TEACHER, GROUP, { duration: '24h', max_uses: 5 });
    await assert.rejects(invites.revokeInvite(ORG_OWNER, inv.id), (e) => e.statusCode === 404);
    const revoked = await invites.revokeInvite(TEACHER, inv.id);
    assert.equal(revoked.status, 'revoked');
    await assert.rejects(join(inv.token, STUDENTS[8]), (e) => e.code === 'INVITE_INACTIVE' && e.details.reason === 'revoked');

    const exp = await invites.createInvite(TEACHER, GROUP, { duration: '24h', max_uses: 5 });
    await pool.query(`UPDATE group_invites SET expires_at = NOW() - INTERVAL '1 minute' WHERE id=$1`, [exp.id]);
    await assert.rejects(join(exp.token, STUDENTS[8]), (e) => e.code === 'INVITE_INACTIVE' && e.details.reason === 'expired');

    await assert.rejects(pool.query(`UPDATE group_invites SET used_count = max_uses + 1 WHERE id=$1`, [exp.id]), /group_invites_used_within_limit/);
  });

  await t.test('join page resolves tokens and keeps legacy MX- codes working', async () => {
    const { findGroupByInvitationCode, getPublicJoinInfo } = require('./joinInvitationService');
    await pool.query(`UPDATE instructor_groups SET join_code='MX-00042' WHERE id=$1`, [GROUP]);
    const legacy = await findGroupByInvitationCode('mx-00042');
    assert.equal(legacy.group_id, GROUP);
    assert.equal(legacy.invite, undefined);
    const inv = await invites.createInvite(TEACHER, GROUP, { duration: '24h', max_uses: 2 });
    const viaToken = await findGroupByInvitationCode(inv.token.toLowerCase());
    assert.equal(viaToken.group_id, GROUP);
    assert.equal(viaToken.invite.id, inv.id);
    assert.equal(viaToken.instructor_name, 'Müəllim');
    assert.equal(await findGroupByInvitationCode('INV-NOTEXISTING1'), null);
    await invites.revokeInvite(TEACHER, inv.id);
    await assert.rejects(getPublicJoinInfo(inv.token), (e) => e.statusCode === 410 && e.code === 'INVITE_INACTIVE');
  });

  await t.test('live lesson topic + post-lesson follow-ups on real tables', async () => {
    const lessons = require('./liveLessonService');
    const pg = require('./participantGroupService');
    const originalPg = { e: pg.addStudentToExamParticipantGroup, a: pg.addStudentToAssignmentParticipantGroup };
    pg.addStudentToExamParticipantGroup = async () => null;
    pg.addStudentToAssignmentParticipantGroup = async () => null;
    try {
      const room = randomUUID();
      const liveGroup = randomUUID();
      await pool.query(`INSERT INTO instructor_groups (id, instructor_id, name) VALUES ($1,$2,'Canlı qrup')`, [liveGroup, TEACHER]);
      const [mat, task, exam, foreignExam] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
      const [s1, s2] = [STUDENTS[0], STUDENTS[1]];
      await pool.query(`INSERT INTO live_rooms (id, room_code, instructor_id, group_id, title, topic, status, provider, join_url, scheduled_at, duration_minutes)
        VALUES ($1,'MX-LIVE01',$2,$3,'Riyaziyyat','Törəmə','waiting','zoom','https://zoom.us/j/1', NOW() - INTERVAL '2 hours', 60)`, [room, TEACHER, liveGroup]);
      await pool.query(`INSERT INTO enrollments (instructor_id, student_id, group_id, status) VALUES ($1,$2,$3,'active'),($1,$4,$3,'active')`, [TEACHER, s1, liveGroup, s2]);
      await pool.query(`INSERT INTO course_materials VALUES ($1,$2,'Konspekt',NULL)`, [mat, TEACHER]);
      await pool.query(`INSERT INTO assignments VALUES ($1,$2,'Ev işi')`, [task, TEACHER]);
      await pool.query(`INSERT INTO exams VALUES ($1,$2,'Mini test',FALSE),($3,$4,'Başqasının',FALSE)`, [exam, TEACHER, foreignExam, ORG_OWNER]);

      await lessons.addFollowup(TEACHER, room, { kind: 'material', ref_id: mat });
      await lessons.addFollowup(TEACHER, room, { kind: 'task', ref_id: task });
      const out = await lessons.addFollowup(TEACHER, room, { kind: 'exam', ref_id: exam, assign: false });
      assert.deepEqual(out.followups.map((f) => [f.kind, f.title]), [['material', 'Konspekt'], ['task', 'Ev işi'], ['exam', 'Mini test']]);
      await assert.rejects(lessons.addFollowup(TEACHER, room, { kind: 'exam', ref_id: foreignExam }), (e) => e.status === 404);

      const sa = await pool.query(`SELECT student_id FROM student_assignments WHERE assignment_id=$1 ORDER BY student_id`, [task]);
      assert.deepEqual(sa.rows.map((r) => r.student_id).sort(), [s1, s2].sort());
      const ea = await pool.query(`SELECT COUNT(*)::int AS n FROM exam_assignments WHERE exam_id=$1`, [exam]);
      assert.equal(ea.rows[0].n, 0);

      const asStudent = await lessons.listFollowupsForUser({ id: s1, role: 'student' }, { id: room, instructor_id: TEACHER });
      assert.deepEqual(asStudent.map((f) => f.kind), ['material', 'task'], 'unassigned exam hidden from students');
      const page = await lessons.getLessonForUser({ id: TEACHER, role: 'instructor' }, { id: room });
      assert.equal(page.topic, 'Törəmə');
      assert.equal(page.followups.length, 3);
      assert.ok(sent.some((n) => n.eventType === 'live_lesson_followup' && n.recipientId === s1));
    } finally {
      pg.addStudentToExamParticipantGroup = originalPg.e;
      pg.addStudentToAssignmentParticipantGroup = originalPg.a;
    }
  });

  await t.test('parent sees only their own child results; released scores only', async (tt) => {
    const PARENT = randomUUID();
    const child = STUDENTS[2];
    const otherChild = STUDENTS[3];
    await pool.query(`INSERT INTO users (id, full_name, role, persona) VALUES ($1,'Valideyn','parent','parent')`, [PARENT]);
    await pool.query(`INSERT INTO student_profiles (user_id, parent_id) VALUES ($1,$2),($3,NULL)`, [child, PARENT, otherChild]);
    const [open, delayed] = [randomUUID(), randomUUID()];
    await pool.query(`INSERT INTO exams (id, instructor_id, title, result_visibility_mode, results_release_at)
      VALUES ($1,$3,'Açıq imtahan','immediate_full_review',NULL),($2,$3,'Gecikmiş','after_exam_window', NOW() + INTERVAL '2 days')`, [open, delayed, TEACHER]);
    await pool.query(`INSERT INTO exam_results (exam_id, student_id, score, submitted_at) VALUES ($1,$3,87,NOW()),($2,$3,55,NOW()),($1,$4,99,NOW())`,
      [open, delayed, child, otherChild]);
    await pool.query(`INSERT INTO platform_feature_flags (key, enabled) VALUES ('feature.exam_result_modes.enabled', TRUE) ON CONFLICT (key) DO NOTHING`);

    const auth = require('../middleware/auth');
    const originalAuth = auth.authenticate;
    auth.authenticate = async (req, _res, next) => {
      const { rows } = await pool.query('SELECT id, role FROM users WHERE id = $1', [req.get('x-test-user')]);
      req.user = { id: rows[0].id, role: rows[0].role };
      next();
    };
    delete require.cache[require.resolve('../routes/parent')];
    const app = express();
    app.use('/api/parent', require('../routes/parent'));
    const server = await new Promise((resolve) => {
      const srv = app.listen(0, '127.0.0.1', () => resolve(srv));
    });
    tt.after(async () => {
      auth.authenticate = originalAuth;
      delete require.cache[require.resolve('../routes/parent')];
      await new Promise((resolve) => server.close(resolve));
    });
    const get = async (p, user) => {
      const r = await fetch(`http://127.0.0.1:${server.address().port}/api/parent${p}`, { headers: { 'x-test-user': user } });
      return { status: r.status, body: await r.json() };
    };
    const kids = await get('/children', PARENT);
    assert.deepEqual(kids.body.children.map((c) => c.id), [child]);
    const res = await get(`/children/${child}/results`, PARENT);
    assert.equal(res.status, 200);
    const byTitle = Object.fromEntries(res.body.exams.map((e) => [e.title, e]));
    assert.equal(byTitle['Açıq imtahan'].score, 87);
    assert.equal(byTitle['Gecikmiş'].score, null, 'unreleased score hidden from parent');
    assert.equal(byTitle['Gecikmiş'].released, false);
    assert.equal((await get(`/children/${otherChild}/results`, PARENT)).status, 404);
    assert.equal((await get(`/children/${child}/results`, TEACHER)).status, 403);
  });

  await t.test('join log shows who joined with which token (teacher only)', async () => {
    const inv = await invites.createInvite(TEACHER, GROUP, { duration: '30d', max_uses: 10, label: 'Sentyabr' });
    await join(inv.token, STUDENTS[9]);
    const out = await invites.listRedemptions(TEACHER, inv.id);
    assert.equal(out.invite.label, 'Sentyabr');
    assert.equal(out.redemptions.length, 1);
    assert.equal(out.redemptions[0].user_id, STUDENTS[9]);
    assert.equal(out.redemptions[0].full_name, 'Tələbə 9');
    await assert.rejects(invites.listRedemptions(ORG_OWNER, inv.id), (e) => e.statusCode === 404);
  });
});
