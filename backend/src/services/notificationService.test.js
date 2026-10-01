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

test('email off by default → the outbox insert is gated off ($17 = false)', async () => {
  reset();
  seedUsers();
  delete process.env.EMAIL_ENABLED;
  const out = await createNotification(baseInput());
  const ins = insertCall();
  assert.equal(ins.params[16], false);
  assert.equal(out.emailStatus, 'suppressed');
});

test('EMAIL_ENABLED=true → queued in the same statement; outbox row holds ids/template/locale only', async () => {
  reset();
  seedUsers();
  process.env.EMAIL_ENABLED = 'true';
  const logs = [];
  const orig = console.log;
  console.log = (...a) => logs.push(a.join(' '));
  let out;
  try {
    out = await createNotification(baseInput());
  } finally {
    console.log = orig;
    delete process.env.EMAIL_ENABLED;
  }
  assert.equal(out.emailStatus, 'queued');
  const ins = insertCall();
  assert.match(ins.sql, /WITH ins AS \(\s*INSERT INTO notifications/);
  assert.match(ins.sql, /INSERT INTO notification_queue/);
  assert.match(ins.sql, /'email:notification:' \|\| ins\.id::text/, 'unique key per notification → no duplicate outbox rows');
  assert.match(ins.sql, /ON CONFLICT \(unique_key\) DO NOTHING/);
  assert.match(ins.sql, /FROM ins\s+WHERE \$17::boolean/, 'deduped notification (no ins row) enqueues nothing');
  assert.equal(ins.params[13], 'queued');
  assert.equal(ins.params[15], 'az');
  assert.equal(ins.params[16], true);
  const outboxPart = ins.sql.slice(ins.sql.indexOf('INSERT INTO notification_queue'));
  assert.doesNotMatch(outboxPart, /\$2\b|\$3\b/, 'title/body are not copied into the outbox');
  assert.equal(logs.length, 0, 'nothing is sent or logged at create time');
});

test('duplicate event with email on → no notification and no outbox row', async () => {
  reset();
  seedUsers();
  state.insertReturns = 'none';
  process.env.EMAIL_ENABLED = 'true';
  try {
    const out = await createNotification(baseInput());
    assert.equal(out.deduped, true);
    assert.equal(out.emailQueued, undefined);
  } finally {
    delete process.env.EMAIL_ENABLED;
  }
});

test('preference email off → outbox gated off even when email is globally on', async () => {
  reset();
  seedUsers();
  state.prefs = [{ category: 'assignment', channel: 'email', event_type: null, enabled: false, frequency: 'off' }];
  process.env.EMAIL_ENABLED = 'true';
  try {
    const out = await createNotification(baseInput());
    assert.equal(out.emailStatus, 'skipped');
    assert.equal(insertCall().params[16], false);
  } finally {
    delete process.env.EMAIL_ENABLED;
  }
});

test('heartbeat / autosave / view events never produce an email intent', async () => {
  for (const eventType of ['heartbeat', 'exam_autosaved', 'page_view', 'exam_question_answered', 'material_opened']) {
    reset();
    seedUsers();
    process.env.EMAIL_ENABLED = 'true';
    try {
      await createNotification({ ...baseInput(), category: 'assessment', eventType, dedupeKey: `${eventType}:1` });
    } finally {
      delete process.env.EMAIL_ENABLED;
    }
    const ins = insertCall();
    assert.ok(ins, `${eventType} still gets its in-app row`);
    assert.equal(ins.params[13], null, `${eventType} has no email status`);
    assert.equal(ins.params[16], false, `${eventType} is never enqueued`);
  }
});

test('security email is mandatory: queued even when the user turned email off', async () => {
  reset();
  seedUsers();
  state.prefs = [{ category: 'security', channel: 'email', event_type: null, enabled: false, frequency: 'off' }];
  process.env.EMAIL_ENABLED = 'true';
  try {
    const out = await createNotification({ recipientId: STUDENT, category: 'security', eventType: 'login_security_alert', title: 'New sign-in', email: true });
    assert.equal(out.emailStatus, 'queued');
    assert.equal(insertCall().params[16], true);
    assert.equal(insertCall().params[15], 'en');
  } finally {
    delete process.env.EMAIL_ENABLED;
  }
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
  await assert.rejects(() => createNotification({ ...baseInput(), category: 'sms' }), /unknown category/);
  await assert.rejects(() => createNotification({ ...baseInput(), eventType: 'Bad Type!' }), /snake_case/);
  await assert.rejects(() => createNotification({ ...baseInput(), recipientId: 'nope' }), /uuid/);
  await assert.rejects(() => createNotification({ ...baseInput(), groupId: '1; drop' }), /uuid/);
  const safe = await createNotificationSafe({ ...baseInput(), category: 'sms' });
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
  assert.equal(emailStatusFor({ eligible: true, frequency: 'immediate' }, { EMAIL_ENABLED: '1' }), 'queued');
  assert.equal(notificationEmailMode({ EMAIL_ENABLED: 'true', EMAIL_DRY_RUN: 'false', EMAIL_ENVIRONMENT: 'production' }), 'live');
  assert.equal(notificationEmailMode({ EMAIL_ENABLED: 'true', EMAIL_ENVIRONMENT: 'production' }), 'dry_run', 'EMAIL_DRY_RUN must be explicitly false');
  assert.equal(notificationEmailMode({ EMAIL_ENABLED: 'true', EMAIL_DRY_RUN: 'false', EMAIL_ENVIRONMENT: 'staging' }), 'dry_run');
});
