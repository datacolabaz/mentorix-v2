const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const dbPath = path.join(__dirname, '../utils/db.js');
const linkPath = path.join(__dirname, '../services/notificationLinkResolver.js');
const smsPath = path.join(__dirname, '../services/smsService.js');

const state = {};
function reset() {
  state.claim = [];
  state.notification = null;
  state.prefs = [];
  state.records = [];
  state.link = { status: 'ok' };
  state.userEmail = null;
  state.recordError = null;
}
reset();

function stub(p, exports) {
  require.cache[p] = { id: p, filename: p, loaded: true, exports };
}

stub(dbPath, {
  query: async (sql, params = []) => {
    if (/WITH due AS/.test(sql)) return { rows: state.claim };
    if (/FROM notifications n\s+JOIN users u/.test(sql)) return { rows: state.notification ? [state.notification] : [] };
    if (/FROM notification_preferences/.test(sql)) return { rows: state.prefs };
    if (/WITH q AS \(\s*UPDATE notification_queue/.test(sql)) {
      if (state.recordError) throw state.recordError;
      state.records.push({ sql, params });
      return { rows: [] };
    }
    if (/SELECT email FROM users/.test(sql)) return { rows: state.userEmail ? [{ email: state.userEmail }] : [] };
    throw new Error(`unexpected query: ${sql}`);
  },
  transaction: async () => {
    throw new Error('not used');
  },
});
stub(linkPath, { resolveNotificationLink: async () => state.link, targetFor: () => null, safeLegacyHref: () => null });
stub(smsPath, { sendSms: async () => ({ success: false, error: 'sms disabled in tests' }) });

const { runNotificationQueueOnce } = require('./notificationQueueWorker');
const { __setProvidersForTests } = require('../services/email/emailTransport');
const { notificationEvents, NOTIFICATION_EVENTS } = require('../services/notificationEvents');

const NID = '11111111-1111-4111-8111-111111111111';
const QID = '99999999-9999-4999-8999-999999999999';
const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const LIVE = { EMAIL_ENABLED: 'true', EMAIL_DRY_RUN: 'false', EMAIL_ENVIRONMENT: 'production', RESEND_API_KEY: 're_test' };
const ENV_KEYS = ['EMAIL_ENABLED', 'EMAIL_DRY_RUN', 'EMAIL_ENVIRONMENT', 'RESEND_API_KEY', 'EMAIL_PROVIDER_API_KEY', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'FRONTEND_PUBLIC_URL'];
let savedEnv = {};

function setEnv(vars) {
  for (const k of ENV_KEYS) delete process.env[k];
  Object.assign(process.env, vars);
}

function queueRow(over = {}) {
  return {
    id: QID,
    channel: 'email',
    event_type: 'assignment_submitted',
    template_key: 'assignment_submitted',
    locale: 'en',
    unique_key: `email:notification:${NID}`,
    user_id: USER,
    to_addr: '__resolve__',
    subject: null,
    body: null,
    notification_id: NID,
    retry_count: 0,
    status: 'sending',
    ...over,
  };
}

function notification(over = {}) {
  return {
    id: NID,
    user_id: USER,
    type: 'assignment_submitted',
    category: 'assignment',
    title: 'Assignment submitted',
    body: 'Aysel submitted the assignment “Faiz”.',
    meta: { i18n: { key: 'assignment_submitted', params: { studentName: 'Aysel', assignmentTitle: 'Faiz' } } },
    email_status: 'queued',
    created_at: new Date('2026-09-29T17:34:00Z'),
    related_entity_type: 'assignment',
    related_entity_id: '22222222-2222-4222-8222-222222222222',
    email: 'teacher.private@example.org',
    role: 'instructor',
    locale: 'en',
    is_active: true,
    deleted_at: null,
    ...over,
  };
}

function fakeProviders(behaviour) {
  const calls = [];
  const make = (name) => async (cfg, msg, opts) => {
    calls.push({ name, msg, opts });
    if (behaviour && behaviour[name]) throw behaviour[name];
    return { messageId: `${name}-msg-1` };
  };
  __setProvidersForTests({ resend: make('resend'), smtp: make('smtp') });
  return calls;
}

function captureEvents() {
  const events = [];
  const onD = (p) => events.push({ name: NOTIFICATION_EVENTS.DELIVERED, p });
  const onF = (p) => events.push({ name: NOTIFICATION_EVENTS.FAILED, p });
  notificationEvents.on(NOTIFICATION_EVENTS.DELIVERED, onD);
  notificationEvents.on(NOTIFICATION_EVENTS.FAILED, onF);
  return {
    events,
    off: () => {
      notificationEvents.off(NOTIFICATION_EVENTS.DELIVERED, onD);
      notificationEvents.off(NOTIFICATION_EVENTS.FAILED, onF);
    },
  };
}

async function quietly(fn) {
  const logs = [];
  const orig = { log: console.log, warn: console.warn, error: console.error };
  console.log = console.warn = console.error = (...a) => logs.push(a.join(' '));
  try {
    return { result: await fn(), logs };
  } finally {
    Object.assign(console, orig);
  }
}

/** [id, queueStatus, retryCount, backoff, provider, messageId, errorCode, errorMsg, notificationStatus] */
function lastRecord() {
  return state.records[state.records.length - 1].params;
}

test.before(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
});
test.after(() => {
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});
test.beforeEach(() => reset());
test.afterEach(() => __setProvidersForTests(null));

test('live: renders in the user locale, sends once with the outbox idempotency key, records sent + DELIVERED', async () => {
  setEnv({ ...LIVE, FRONTEND_PUBLIC_URL: 'https://app.example' });
  const calls = fakeProviders();
  state.claim = [queueRow()];
  state.notification = notification();
  const ev = captureEvents();
  try {
    await quietly(() => runNotificationQueueOnce());
  } finally {
    ev.off();
  }
  assert.equal(calls.length, 1);
  const { msg, opts } = calls[0];
  assert.equal(msg.to, 'teacher.private@example.org');
  assert.equal(msg.subject, 'Assignment submitted');
  assert.match(msg.text, /Time: Sep 29, 2026, 21:34/);
  assert.match(msg.text, new RegExp(`https://app\\.example/notifications\\?open=${NID}`));
  assert.equal(opts.idempotencyKey, `email:notification:${NID}`);
  const r = lastRecord();
  assert.equal(r[1], 'sent');
  assert.equal(r[4], 'resend');
  assert.equal(r[5], 'resend-msg-1');
  assert.equal(r[8], 'sent', 'notifications.email_status updated in the same statement');
  assert.match(state.records[0].sql, /email_sent_at = CASE WHEN \$9 = 'sent' THEN NOW\(\)/);
  assert.deepEqual(ev.events.map((e) => e.name), ['NOTIFICATION_DELIVERED']);
  assert.equal(ev.events[0].p.notificationId, NID);
});

test('suppressed (or already handled) notifications are never sent', async () => {
  setEnv(LIVE);
  for (const status of ['suppressed', 'skipped', 'sent', 'dry_run', 'digest', null]) {
    reset();
    const calls = fakeProviders();
    state.claim = [queueRow()];
    state.notification = notification({ email_status: status });
    await quietly(() => runNotificationQueueOnce());
    assert.equal(calls.length, 0, `status ${status}`);
    assert.equal(lastRecord()[1], 'suppressed');
    assert.equal(lastRecord()[8], null, 'notification email_status left untouched');
  }
});

test('dry-run (EMAIL_ENABLED only): nothing sent, dry_run recorded, log has no address/body', async () => {
  setEnv({ EMAIL_ENABLED: 'true', EMAIL_ENVIRONMENT: 'production', RESEND_API_KEY: 're_test' });
  const calls = fakeProviders();
  state.claim = [queueRow()];
  state.notification = notification();
  const { logs } = await quietly(() => runNotificationQueueOnce());
  assert.equal(calls.length, 0);
  assert.equal(lastRecord()[1], 'dry_run');
  assert.equal(lastRecord()[8], 'dry_run');
  const all = logs.join('\n');
  assert.match(all, /\[email:dry_run\] stream=notification template=assignment_submitted locale=en to=t\*\*\*@e\*\*\*\.org/);
  assert.doesNotMatch(all, /teacher\.private|Aysel|Faiz|Assignment submitted|open=/);
});

test('preference turned off after enqueue → skipped, not sent', async () => {
  setEnv(LIVE);
  const calls = fakeProviders();
  state.claim = [queueRow()];
  state.notification = notification();
  state.prefs = [{ category: 'assignment', event_type: null, channel: 'email', enabled: false, frequency: 'off' }];
  await quietly(() => runNotificationQueueOnce());
  assert.equal(calls.length, 0);
  assert.equal(lastRecord()[1], 'skipped');
  assert.equal(lastRecord()[6], 'preference_changed');
});

test('security email is mandatory: preference off does not stop it', async () => {
  setEnv(LIVE);
  const calls = fakeProviders();
  state.claim = [queueRow({ event_type: 'login_security_alert', template_key: 'login_security_alert' })];
  state.notification = notification({ type: 'login_security_alert', category: 'security', title: 'New sign-in', body: 'A new sign-in', meta: {} });
  state.prefs = [{ category: 'security', event_type: null, channel: 'email', enabled: false, frequency: 'off' }];
  await quietly(() => runNotificationQueueOnce());
  assert.equal(calls.length, 1);
  assert.equal(calls[0].msg.subject, 'New sign-in', 'generic template uses the stored safe title');
  assert.equal(lastRecord()[1], 'sent');
});

test('deleted notification / deleted entity / revoked access → skipped with a safe reason', async () => {
  setEnv(LIVE);
  const calls = fakeProviders();
  state.claim = [queueRow()];
  state.notification = null;
  await quietly(() => runNotificationQueueOnce());
  assert.equal(lastRecord()[6], 'entity_gone');

  state.notification = notification();
  state.link = { status: 'not_found' };
  await quietly(() => runNotificationQueueOnce());
  assert.equal(lastRecord()[6], 'entity_gone');

  state.link = { status: 'forbidden' };
  await quietly(() => runNotificationQueueOnce());
  assert.equal(lastRecord()[6], 'access_revoked');

  state.link = { status: 'ok' };
  state.notification = notification({ is_active: false });
  await quietly(() => runNotificationQueueOnce());
  assert.equal(lastRecord()[6], 'recipient_unavailable');
  assert.equal(calls.length, 0);
});

test('transient failure → back to queued with backoff; retry reuses the same idempotency key', async () => {
  setEnv(LIVE);
  const calls = fakeProviders({ resend: Object.assign(new Error('upstream down'), { statusCode: 503 }) });
  state.claim = [queueRow()];
  state.notification = notification();
  const ev = captureEvents();
  try {
    await quietly(() => runNotificationQueueOnce());
    let r = lastRecord();
    assert.equal(r[1], 'queued', 'notification rows retry as queued, never pending/retrying');
    assert.equal(r[2], 1);
    assert.equal(r[3], 1, '1 minute backoff');
    assert.equal(r[8], null);

    state.claim = [queueRow({ retry_count: 1 })];
    await quietly(() => runNotificationQueueOnce());
    r = lastRecord();
    assert.equal(r[1], 'queued');
    assert.equal(r[3], 5, '5 minute backoff');

    state.claim = [queueRow({ retry_count: 2 })];
    await quietly(() => runNotificationQueueOnce());
    r = lastRecord();
    assert.equal(r[1], 'failed', 'third attempt is the last');
    assert.equal(r[8], 'failed');
  } finally {
    ev.off();
  }
  assert.equal(new Set(calls.map((c) => c.opts.idempotencyKey)).size, 1, 'provider dedupes retries by one key');
  assert.deepEqual(ev.events.map((e) => e.name), ['NOTIFICATION_FAILED']);
});

test('permanent failure is recorded with a safe error and emits NOTIFICATION_FAILED', async () => {
  setEnv(LIVE);
  fakeProviders({
    resend: Object.assign(new Error('Invalid `to` field teacher.private@example.org'), { statusCode: 422, name: 'validation_error' }),
  });
  state.claim = [queueRow()];
  state.notification = notification();
  const ev = captureEvents();
  try {
    await quietly(() => runNotificationQueueOnce());
  } finally {
    ev.off();
  }
  const r = lastRecord();
  assert.equal(r[1], 'failed');
  assert.equal(r[6], 'validation_error');
  assert.doesNotMatch(String(r[7]), /teacher\.private/);
  assert.equal(r[8], 'failed');
  assert.match(state.records[0].sql, /failed_at = CASE WHEN \$2 = 'failed' THEN NOW\(\)/);
  assert.equal(ev.events.length, 1);
  assert.equal(ev.events[0].p.errorCode, 'validation_error');
});

test('max attempts reached (e.g. reclaimed stale row) → failed without sending', async () => {
  setEnv(LIVE);
  const calls = fakeProviders();
  state.claim = [queueRow({ retry_count: 3 })];
  state.notification = notification();
  await quietly(() => runNotificationQueueOnce());
  assert.equal(calls.length, 0);
  assert.equal(lastRecord()[1], 'failed');
  assert.equal(lastRecord()[6], 'max_attempts');
});

test('live mode but no provider → failed provider_unavailable (visible to ops)', async () => {
  setEnv({ EMAIL_ENABLED: 'true', EMAIL_DRY_RUN: 'false', EMAIL_ENVIRONMENT: 'production' });
  state.claim = [queueRow()];
  state.notification = notification();
  await quietly(() => runNotificationQueueOnce());
  assert.equal(lastRecord()[1], 'failed');
  assert.equal(lastRecord()[6], 'provider_unavailable');
});

test('legacy queue row without SMTP is skipped (Resend is not used before opt-in)', async () => {
  setEnv({ RESEND_API_KEY: 're_test', EMAIL_ENVIRONMENT: 'production' });
  const calls = fakeProviders();
  state.userEmail = 'student@example.org';
  state.claim = [queueRow({ template_key: null, notification_id: null, event_type: 'exam_placed', subject: 'S', body: 'B', unique_key: 'exam_placed:1' })];
  await quietly(() => runNotificationQueueOnce());
  assert.equal(calls.length, 0);
  assert.equal(lastRecord()[1], 'skipped');
});

test('legacy queue row with SMTP configured still goes out via SMTP', async () => {
  setEnv({ SMTP_HOST: 'smtp.test', SMTP_USER: 'u', SMTP_PASS: 'p', EMAIL_ENVIRONMENT: 'production' });
  const calls = fakeProviders();
  state.claim = [queueRow({ template_key: null, notification_id: null, event_type: 'exam_placed', subject: 'S', body: 'B', to_addr: 'student@example.org', unique_key: 'exam_placed:1' })];
  await quietly(() => runNotificationQueueOnce());
  assert.deepEqual(calls.map((c) => c.name), ['smtp']);
  assert.equal(lastRecord()[1], 'sent');
});

test('if recording the outcome fails, no event is emitted and the worker continues', async () => {
  setEnv(LIVE);
  fakeProviders();
  state.claim = [queueRow()];
  state.notification = notification();
  state.recordError = new Error('db down');
  const ev = captureEvents();
  let result;
  try {
    ({ result } = await quietly(() => runNotificationQueueOnce()));
  } finally {
    ev.off();
  }
  assert.equal(result.processed, 1);
  assert.equal(ev.events.length, 0);
});
