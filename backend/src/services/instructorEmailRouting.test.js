const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const dbPath = path.join(__dirname, '../utils/db.js');
const linkPath = path.join(__dirname, 'notificationLinkResolver.js');
const smsPath = path.join(__dirname, 'smsService.js');

const TEACHER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const state = {};
function reset() {
  state.prefs = [];
  state.notifications = new Map();
  state.queue = [];
  state.records = [];
}
reset();

function stub(p, exports) {
  require.cache[p] = { id: p, filename: p, loaded: true, exports };
}

stub(dbPath, {
  query: async (sql, params = []) => {
    if (/FROM users WHERE id/.test(sql)) {
      return { rows: [{ id: TEACHER, email: 'teacher@example.org', role: 'instructor', locale: 'az', is_active: true, deleted_at: null }] };
    }
    if (/FROM notification_preferences/.test(sql)) return { rows: state.prefs };
    if (/WITH ins AS/.test(sql)) {
      const [userId, title, body, type, , , category, , , , , , , emailStatus, dedupeKey, locale, outbox, id, subject, text, legacy] = params;
      if (dedupeKey && [...state.notifications.values()].some((n) => n.dedupe_key === dedupeKey)) return { rows: [] };
      state.notifications.set(id, { id, user_id: userId, title, body, type, category, email_status: emailStatus, dedupe_key: dedupeKey, created_at: new Date() });
      const base = { id: `q${state.queue.length + 1}`, channel: 'email', event_type: type, user_id: userId, to_addr: '__resolve__', notification_id: id, retry_count: 0 };
      if (outbox) state.queue.push({ ...base, unique_key: `email:notification:${id}`, template_key: type, locale, status: 'queued' });
      if (legacy && !outbox) state.queue.push({ ...base, unique_key: `email:legacy:${id}`, template_key: null, subject, body: text, status: 'pending' });
      return { rows: [{ id, queued: outbox ? 1 : 0, legacy_queued: legacy && !outbox ? 1 : 0 }] };
    }
    if (/WITH due AS/.test(sql)) {
      const due = state.queue.filter((r) => ['queued', 'pending', 'retrying'].includes(r.status));
      due.forEach((r) => (r.status = 'sending'));
      return { rows: due.map((r) => ({ ...r })) };
    }
    if (/FROM notifications n\s+JOIN users u/.test(sql)) {
      const n = state.notifications.get(params[0]);
      return { rows: n ? [{ ...n, meta: {}, email: 'teacher@example.org', role: 'instructor', locale: 'az', is_active: true, deleted_at: null }] : [] };
    }
    if (/WITH q AS \(\s*UPDATE notification_queue/.test(sql)) {
      state.records.push(params);
      const row = state.queue.find((r) => r.id === params[0]);
      if (row) row.status = params[1];
      return { rows: [] };
    }
    throw new Error(`unexpected query: ${sql.slice(0, 80)}`);
  },
  transaction: async () => {
    throw new Error('not used');
  },
});
stub(linkPath, { resolveNotificationLink: async () => ({ status: 'ok' }), targetFor: () => null, safeLegacyHref: () => null });
stub(smsPath, { sendSms: async () => ({ success: false }) });

const { createNotification } = require('./notificationService');
const { emailRoute } = require('./notificationEmailGate');
const { runNotificationQueueOnce } = require('../jobs/notificationQueueWorker');
const { __setProvidersForTests } = require('./email/emailTransport');

const ENV_KEYS = ['EMAIL_ENABLED', 'EMAIL_DRY_RUN', 'EMAIL_ENVIRONMENT', 'RESEND_API_KEY', 'EMAIL_PROVIDER_API_KEY', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'NODE_ENV', 'RAILWAY_ENVIRONMENT_NAME', 'RAILWAY_ENVIRONMENT'];
const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
test.after(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

const MODES = {
  off: { EMAIL_ENVIRONMENT: 'production' },
  dry_run: { EMAIL_ENVIRONMENT: 'production', EMAIL_ENABLED: 'true' },
  live: { EMAIL_ENVIRONMENT: 'production', EMAIL_ENABLED: 'true', EMAIL_DRY_RUN: 'false' },
};
const SMTP = { SMTP_HOST: 'smtp.test', SMTP_USER: 'u', SMTP_PASS: 'p' };
const RESEND = { RESEND_API_KEY: 're_test' };

function envFor(mode, smtp, resend) {
  return { ...MODES[mode], ...(smtp ? SMTP : {}), ...(resend ? RESEND : {}) };
}

function setEnv(vars) {
  for (const k of ENV_KEYS) delete process.env[k];
  Object.assign(process.env, vars);
}

const EVENTS = [
  { eventType: 'join_request', category: 'group', params: { studentName: 'Aysel', groupName: 'Riyaziyyat 9A' } },
  { eventType: 'exam_access_request', category: 'assessment', params: { studentName: 'Aysel', examTitle: 'Buraxılış' } },
  { eventType: 'task_access_request', category: 'assignment', params: { studentName: 'Aysel', taskTitle: 'Faiz' } },
  { eventType: 'open_grading_pending', category: 'grading', params: { count: 3, examTitle: 'Buraxılış' } },
];

let seq = 0;
function input(ev) {
  seq += 1;
  return { recipientId: TEACHER, category: ev.category, eventType: ev.eventType, title: 'T', body: 'B', params: ev.params, dedupeKey: `${ev.eventType}:${seq}`, email: true };
}

async function deliver(ev) {
  const calls = [];
  const fake = (name) => async (cfg, msg) => {
    calls.push({ name, msg });
    return { messageId: `${name}-1` };
  };
  __setProvidersForTests({ resend: fake('resend'), smtp: fake('smtp') });
  const orig = { log: console.log, error: console.error, warn: console.warn };
  console.log = console.error = console.warn = () => {};
  try {
    const out = await createNotification(input(ev));
    await runNotificationQueueOnce();
    await runNotificationQueueOnce();
    return { out, calls };
  } finally {
    Object.assign(console, orig);
    __setProvidersForTests(null);
  }
}

/** Expected real sends: live → outbox (any provider); otherwise legacy → only with SMTP. */
function expectedSends(mode, smtp, resend) {
  if (mode === 'live') return smtp || resend ? 1 : 0;
  return smtp ? 1 : 0;
}

for (const ev of EVENTS) {
  for (const mode of Object.keys(MODES)) {
    for (const smtp of [true, false]) {
      for (const resend of [true, false]) {
        test(`${ev.eventType}: mode=${mode} smtp=${smtp} resend=${resend} → exactly ${expectedSends(mode, smtp, resend)} send(s)`, async () => {
          reset();
          setEnv(envFor(mode, smtp, resend));
          const { out, calls } = await deliver(ev);
          assert.equal(out.created, true);
          const expectedRoute = mode === 'live' ? 'outbox' : smtp ? 'legacy' : mode === 'off' ? 'none' : 'outbox';
          assert.equal(out.emailRoute, expectedRoute);
          assert.ok(state.queue.length <= 1, 'never both an outbox and a legacy row');
          assert.equal(calls.length, expectedSends(mode, smtp, resend));
          if (expectedRoute === 'legacy') {
            assert.deepEqual(calls.map((c) => c.name), ['smtp'], 'legacy path never uses Resend before opt-in');
            assert.equal(state.queue[0].template_key, null);
          }
          if (expectedRoute === 'outbox' && calls.length) assert.equal(calls[0].name, resend ? 'resend' : 'smtp');
        });
      }
    }
  }
}

test('legacy email: localized template text with deep link, no placeholders; notification status follows the delivery', async () => {
  reset();
  setEnv(envFor('off', true, false));
  const { out, calls } = await deliver(EVENTS[0]);
  const { msg } = calls[0];
  assert.equal(msg.subject, 'Yeni qoşulma sorğusu');
  assert.match(msg.text, /Aysel «Riyaziyyat 9A» qrupunuza qoşulmaq istəyir\./);
  assert.match(msg.text, new RegExp(`/notifications\\?open=${out.id}`));
  assert.doesNotMatch(msg.text, /undefined|null/);
  assert.equal(state.notifications.get(out.id).email_status, 'queued');
  const rec = state.records[state.records.length - 1];
  assert.deepEqual([rec[1], rec[8]], ['sent', 'sent'], 'queue row and notifications.email_status both record sent');
});

test('EMAIL_DRY_RUN=true with SMTP: legacy route still chosen but nothing is really sent', async () => {
  reset();
  setEnv({ ...envFor('off', true, true), EMAIL_DRY_RUN: 'true' });
  const { out, calls } = await deliver(EVENTS[1]);
  assert.equal(out.emailRoute, 'legacy');
  assert.equal(calls.length, 0);
  assert.equal(state.records[state.records.length - 1][1], 'dry_run');
});

test('recipient preference off → zero sends in every mode (legacy path respects preferences too)', async () => {
  for (const mode of Object.keys(MODES)) {
    reset();
    state.prefs = [{ category: 'group', event_type: null, channel: 'email', enabled: false, frequency: 'off' }];
    setEnv(envFor(mode, true, true));
    const { out, calls } = await deliver(EVENTS[0]);
    assert.equal(out.emailRoute, 'none', mode);
    assert.equal(calls.length, 0, mode);
    assert.equal(state.queue.length, 0, mode);
  }
});

test('daily digest preference → no immediate email on either path', async () => {
  reset();
  state.prefs = [{ category: 'group', event_type: null, channel: 'email', enabled: true, frequency: 'daily' }];
  setEnv(envFor('off', true, true));
  const { out, calls } = await deliver(EVENTS[0]);
  assert.equal(out.emailStatus, 'digest');
  assert.equal(calls.length, 0);
});

test('duplicate event → no second legacy email', async () => {
  reset();
  setEnv(envFor('off', true, false));
  const ev = EVENTS[0];
  const first = input(ev);
  const orig = console.log;
  console.log = () => {};
  try {
    await createNotification(first);
    const again = await createNotification(first);
    assert.equal(again.deduped, true);
  } finally {
    console.log = orig;
  }
  assert.equal(state.queue.length, 1);
});

test('events without a legacy fallback never use the legacy path', async () => {
  reset();
  setEnv(envFor('off', true, true));
  const { out, calls } = await deliver({ eventType: 'assignment_submitted', category: 'assignment', params: { studentName: 'A', assignmentTitle: 'B' } });
  assert.equal(out.emailRoute, 'none');
  assert.equal(calls.length, 0);
});

test('emailRoute decision table (pure)', () => {
  const imm = { eligible: true, frequency: 'immediate' };
  const cases = [
    ['join_request', 'off', false, 'none'],
    ['join_request', 'off', true, 'legacy'],
    ['join_request', 'dry_run', false, 'outbox'],
    ['join_request', 'dry_run', true, 'legacy'],
    ['join_request', 'live', false, 'outbox'],
    ['join_request', 'live', true, 'outbox'],
    ['assignment_submitted', 'off', true, 'none'],
    ['assignment_submitted', 'dry_run', true, 'outbox'],
    ['exam_assigned', 'off', true, 'legacy'],
    ['exam_assigned', 'off', false, 'none'],
    ['catalog_exam_approved', 'dry_run', true, 'legacy'],
    ['catalog_exam_rejected', 'live', true, 'outbox'],
  ];
  for (const [eventType, mode, smtp, route] of cases) {
    assert.equal(emailRoute({ eventType, emailDecision: imm }, envFor(mode, smtp, true)), route, `${eventType}/${mode}/smtp=${smtp}`);
  }
  assert.equal(emailRoute({ eventType: 'join_request', emailDecision: { eligible: false } }, envFor('off', true, true)), 'none');
  assert.equal(emailRoute({ eventType: 'join_request', emailDecision: { eligible: true, frequency: 'weekly' } }, envFor('off', true, true)), 'none');
});
