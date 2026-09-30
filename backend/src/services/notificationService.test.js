const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const dbPath = path.join(__dirname, '../utils/db.js');
const state = { calls: [], users: {}, prefs: [], insertReturns: 'row', insertError: null };

function reset() {
  state.calls = [];
  state.users = {};
  state.prefs = [];
  state.insertReturns = 'row';
  state.insertError = null;
}

require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    query: async (sql, params = []) => {
      state.calls.push({ sql, params });
      if (/FROM users WHERE id/.test(sql)) {
        const u = state.users[params[0]];
        return { rows: u ? [u] : [] };
      }
      if (/FROM notification_preferences/.test(sql)) return { rows: state.prefs };
      if (/INSERT INTO notifications \(\s*user_id, title, body, type, is_read, read_at/.test(sql)) {
        if (state.insertError) throw state.insertError;
        return { rows: state.insertReturns === 'row' ? [{ id: '11111111-1111-4111-8111-111111111111' }] : [] };
      }
      if (/INSERT INTO notifications \(user_id, title, body, type, is_read, meta\)/.test(sql)) {
        return { rows: [{ id: '22222222-2222-4222-8222-222222222222' }] };
      }
      throw new Error(`unexpected query: ${sql}`);
    },
    transaction: async () => {
      throw new Error('not used');
    },
  },
};

const { createNotification, createNotificationSafe } = require('./notificationService');
const { emailStatusFor, notificationEmailMode } = require('./notificationEmailGate');

const TEACHER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const STUDENT = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function seedUsers() {
  state.users[TEACHER] = { id: TEACHER, role: 'instructor', locale: 'az', is_active: true, deleted_at: null };
  state.users[STUDENT] = { id: STUDENT, role: 'student', locale: 'en', is_active: true, deleted_at: null };
}

function insertCall() {
  return state.calls.find((c) => /INSERT INTO notifications/.test(c.sql));
}

const baseInput = () => ({
  recipientId: TEACHER,
  category: 'assignment',
  eventType: 'assignment_submitted',
  title: 'Tapşırıq təslim edildi',
  body: 'x',
  params: { studentName: 'Aysel', assignmentTitle: 'Faiz' },
  dedupeKey: 'assignment_submitted:sa1',
  email: true,
});

test('creates an in-app row with category, priority, dedupe key and email intent', async () => {
  reset();
  seedUsers();
  delete process.env.EMAIL_ENABLED;
  const out = await createNotification(baseInput());
  assert.equal(out.created, true);
  const ins = insertCall();
  const [userId, title, body, type, isRead, metaJson, category, priority, , , , , , emailStatus, dedupe] = ins.params;
  assert.equal(userId, TEACHER);
  assert.equal(title, 'Tapşırıq təslim edildi');
  assert.equal(body, 'Aysel «Faiz» tapşırığını təslim etdi.');
  assert.equal(type, 'assignment_submitted');
  assert.equal(isRead, false);
  assert.equal(category, 'assignment');
  assert.equal(priority, 'NORMAL');
  assert.equal(emailStatus, 'suppressed', 'email globally off by default → intent recorded, nothing sent');
  assert.equal(dedupe, 'assignment_submitted:sa1');
  assert.deepEqual(JSON.parse(metaJson).i18n, { key: 'assignment_submitted', params: { studentName: 'Aysel', assignmentTitle: 'Faiz' } });
  assert.match(ins.sql, /ON CONFLICT \(user_id, dedupe_key\) WHERE dedupe_key IS NOT NULL DO NOTHING/);
});

test('duplicate event (same dedupe key) does not create a second notification', async () => {
  reset();
  seedUsers();
  state.insertReturns = 'none';
  const out = await createNotification(baseInput());
  assert.equal(out.created, false);
  assert.equal(out.deduped, true);
  assert.equal(out.id, null);
});

test('preferences are checked BEFORE the row/email intent is written', async () => {
  reset();
  seedUsers();
  state.prefs = [{ category: 'assignment', channel: 'email', event_type: null, enabled: false, frequency: 'off' }];
  const out = await createNotification(baseInput());
  const idxPrefs = state.calls.findIndex((c) => /notification_preferences/.test(c.sql));
  const idxInsert = state.calls.findIndex((c) => /INSERT INTO notifications/.test(c.sql));
  assert.ok(idxPrefs >= 0 && idxPrefs < idxInsert, 'preference lookup happens first');
  assert.equal(out.emailStatus, 'skipped');
  assert.equal(insertCall().params[13], 'skipped');
});

test('never writes to notification_queue in Phase A (SMTP worker cannot send)', async () => {
  reset();
  seedUsers();
  process.env.EMAIL_ENABLED = 'true';
  await createNotification(baseInput());
  delete process.env.EMAIL_ENABLED;
  assert.equal(state.calls.some((c) => /notification_queue/.test(c.sql)), false);
});

test('EMAIL_ENABLED=true only produces dry_run status with a safe log (no address, no body)', async () => {
  reset();
  seedUsers();
  process.env.EMAIL_ENABLED = 'true';
  const logs = [];
  const orig = console.log;
  console.log = (...a) => logs.push(a.join(' '));
  try {
    const out = await createNotification(baseInput());
    assert.equal(out.emailStatus, 'dry_run');
  } finally {
    console.log = orig;
    delete process.env.EMAIL_ENABLED;
  }
  assert.equal(logs.length, 1);
  assert.match(logs[0], /\[notify-email:dry_run\] template=assignment_submitted/);
  assert.doesNotMatch(logs[0], /Aysel|Faiz|@/);
});

test('security notifications skip the preference lookup and cannot be silenced', async () => {
  reset();
  seedUsers();
  state.prefs = [
    { category: 'security', channel: 'in_app', event_type: null, enabled: false, frequency: 'off' },
    { category: 'security', channel: 'email', event_type: null, enabled: false, frequency: 'off' },
  ];
  const out = await createNotification({
    recipientId: STUDENT,
    category: 'security',
    eventType: 'login_security_alert',
    title: 'New sign-in',
    email: true,
  });
  assert.equal(out.created, true);
  assert.equal(out.inApp, true);
  assert.equal(state.calls.some((c) => /notification_preferences/.test(c.sql)), false);
  const ins = insertCall();
  assert.equal(ins.params[4], false, 'not silent');
  assert.equal(ins.params[7], 'CRITICAL');
  assert.equal(ins.params[13], 'suppressed');
});

test('in-app off + email off → nothing is written', async () => {
  reset();
  seedUsers();
  state.prefs = [
    { category: 'assignment', channel: 'in_app', event_type: null, enabled: false, frequency: 'off' },
    { category: 'assignment', channel: 'email', event_type: null, enabled: false, frequency: 'off' },
  ];
  const out = await createNotification(baseInput());
  assert.equal(out.created, false);
  assert.equal(out.reason, 'disabled_by_preference');
  assert.equal(insertCall(), undefined);
});

test('in-app off but email on → stored silently (already read) for the email intent', async () => {
  reset();
  seedUsers();
  state.prefs = [{ category: 'assignment', channel: 'in_app', event_type: null, enabled: false, frequency: 'off' }];
  const out = await createNotification(baseInput());
  assert.equal(out.created, true);
  assert.equal(out.inApp, false);
  const ins = insertCall();
  assert.equal(ins.params[4], true);
  assert.equal(JSON.parse(ins.params[5]).silent, true);
});

test('daily email frequency is stored as digest intent', async () => {
  reset();
  seedUsers();
  state.prefs = [{ category: 'assignment', channel: 'email', event_type: null, enabled: true, frequency: 'daily' }];
  const out = await createNotification(baseInput());
  assert.equal(out.emailStatus, 'digest');
  assert.equal(JSON.parse(insertCall().params[5]).email_frequency, 'daily');
});

test('title/body are rendered in the recipient locale', async () => {
  reset();
  seedUsers();
  await createNotification({ ...baseInput(), recipientId: STUDENT, category: 'assignment' });
  const ins = insertCall();
  assert.equal(ins.params[1], 'Assignment submitted');
  assert.equal(ins.params[2], 'Aysel submitted the assignment “Faiz”.');
});

test('the recipient is always the given user (no fan-out, no other user ids)', async () => {
  reset();
  seedUsers();
  await createNotification(baseInput());
  const ins = insertCall();
  assert.equal(ins.params[0], TEACHER);
  assert.equal(ins.params.filter((p) => p === STUDENT).length, 0);
});

test('unknown / inactive recipient is skipped', async () => {
  reset();
  seedUsers();
  state.users[TEACHER].is_active = false;
  const out = await createNotification(baseInput());
  assert.equal(out.reason, 'recipient_not_found');
  assert.equal(insertCall(), undefined);
});

test('input validation rejects bad category / event type / ids', async () => {
  reset();
  seedUsers();
  await assert.rejects(() => createNotification({ ...baseInput(), category: 'marketing' }), /unknown category/);
  await assert.rejects(() => createNotification({ ...baseInput(), eventType: 'Bad Type!' }), /snake_case/);
  await assert.rejects(() => createNotification({ ...baseInput(), recipientId: 'nope' }), /uuid/);
  await assert.rejects(() => createNotification({ ...baseInput(), groupId: '1; drop' }), /uuid/);
  const safe = await createNotificationSafe({ ...baseInput(), category: 'marketing' });
  assert.equal(safe.created, false);
});

test('falls back to the legacy insert if migration 214 columns are missing', async () => {
  reset();
  seedUsers();
  state.insertError = Object.assign(new Error('column "category" does not exist'), { code: '42703' });
  const out = await createNotification(baseInput());
  assert.equal(out.created, true);
  assert.equal(out.legacy, true);
});

test('email gate helpers', () => {
  assert.equal(notificationEmailMode({}), 'off');
  assert.equal(notificationEmailMode({ EMAIL_ENABLED: 'false' }), 'off');
  assert.equal(notificationEmailMode({ EMAIL_ENABLED: 'true' }), 'dry_run');
  assert.equal(emailStatusFor({ eligible: false, reason: 'not_requested' }, {}), null);
  assert.equal(emailStatusFor({ eligible: false, reason: 'never_email' }, {}), null);
  assert.equal(emailStatusFor({ eligible: false, reason: 'preference_off' }, {}), 'skipped');
  assert.equal(emailStatusFor({ eligible: true, frequency: 'weekly' }, {}), 'digest');
  assert.equal(emailStatusFor({ eligible: true, frequency: 'immediate' }, {}), 'suppressed');
  assert.equal(emailStatusFor({ eligible: true, frequency: 'immediate' }, { EMAIL_ENABLED: '1' }), 'dry_run');
});
