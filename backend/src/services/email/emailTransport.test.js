const test = require('node:test');
const assert = require('node:assert/strict');

const { sendMail, maskEmail, classifyError, safeMessage, __setProvidersForTests } = require('./emailTransport');

const PROD = { RESEND_API_KEY: 're_x', SMTP_HOST: 'h', SMTP_USER: 'u', SMTP_PASS: 'p', EMAIL_ENVIRONMENT: 'production' };
const MSG = {
  stream: 'transactional',
  to: 'aysel.mammadova@gmail.com',
  subject: 'Şifrə sıfırlama — gizli mövzu',
  text: 'Kod: 123456 https://mentorix.io/reset-password?token=SECRET_TOKEN',
  html: '<p>SECRET_TOKEN</p>',
  templateKey: 'password_reset',
  locale: 'az',
};

function fakeProviders(behaviour = {}) {
  const calls = [];
  const make = (name) => async (cfg, msg, opts) => {
    calls.push({ name, msg, opts });
    const b = behaviour[name];
    if (b instanceof Error || (b && b.throw)) throw b.throw || b;
    return { messageId: `${name}-id` };
  };
  __setProvidersForTests({ resend: make('resend'), smtp: make('smtp') });
  return calls;
}

function captureLogs(fn) {
  const logs = [];
  const orig = { log: console.log, warn: console.warn, error: console.error, info: console.info };
  console.log = console.warn = console.error = console.info = (...a) => logs.push(a.join(' '));
  return Promise.resolve()
    .then(fn)
    .then(
      (r) => ({ r, logs }),
      (e) => ({ e, logs }),
    )
    .finally(() => Object.assign(console, orig));
}

test.afterEach(() => __setProvidersForTests(null));

test('dry-run sends nothing and logs only masked recipient + template + locale', async () => {
  const calls = fakeProviders();
  const { r, logs } = await captureLogs(() => sendMail(MSG, { env: { ...PROD, EMAIL_DRY_RUN: 'true' }, ref: 'n:abc' }));
  assert.equal(calls.length, 0, 'no provider call');
  assert.equal(r.status, 'dry_run');
  assert.equal(r.ok, false);
  assert.equal(logs.length, 1);
  assert.match(logs[0], /\[email:dry_run\] stream=transactional template=password_reset locale=az to=a\*\*\*@g\*\*\*\.com ref=n:abc/);
  assert.doesNotMatch(logs[0], /aysel|mammadova|gmail|SECRET_TOKEN|123456|mövzu|Şifrə|https?:/);
});

test('non-production environment → dry-run even for transactional mail', async () => {
  const calls = fakeProviders();
  const { r } = await captureLogs(() => sendMail(MSG, { env: { ...PROD, EMAIL_ENVIRONMENT: 'staging' } }));
  assert.equal(r.status, 'dry_run');
  assert.equal(calls.length, 0);
});

test('notification stream is dry-run unless all opt-ins are set', async () => {
  const calls = fakeProviders();
  const msg = { ...MSG, stream: 'notification' };
  const a = await captureLogs(() => sendMail(msg, { env: PROD }));
  const b = await captureLogs(() => sendMail(msg, { env: { ...PROD, EMAIL_ENABLED: 'true' } }));
  assert.equal(a.r.status, 'dry_run');
  assert.equal(b.r.status, 'dry_run');
  assert.equal(calls.length, 0);
  const c = await sendMail(msg, { env: { ...PROD, EMAIL_ENABLED: 'true', EMAIL_DRY_RUN: 'false' }, idempotencyKey: 'email:notification:1' });
  assert.equal(c.status, 'sent');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'resend');
  assert.equal(calls[0].opts.idempotencyKey, 'email:notification:1');
});

test('live transactional: Resend first, SMTP fallback on transient error', async () => {
  const calls = fakeProviders({ resend: Object.assign(new Error('upstream'), { statusCode: 503 }) });
  const r = await sendMail(MSG, { env: PROD });
  assert.equal(r.status, 'sent');
  assert.equal(r.provider, 'smtp');
  assert.deepEqual(calls.map((c) => c.name), ['resend', 'smtp']);
});

test('permanent rejection is not retried on another provider', async () => {
  const calls = fakeProviders({ resend: Object.assign(new Error('The mentorix.io domain is not verified'), { statusCode: 403 }) });
  const r = await sendMail(MSG, { env: PROD });
  assert.equal(r.status, 'failed');
  assert.equal(r.errorCode, 'sender_not_verified');
  assert.equal(r.transient, false);
  assert.deepEqual(calls.map((c) => c.name), ['resend']);
});

test('invalid recipient fails before any provider call', async () => {
  const calls = fakeProviders();
  const r = await sendMail({ ...MSG, to: 'not-an-email' }, { env: PROD });
  assert.equal(r.errorCode, 'invalid_recipient');
  assert.equal(calls.length, 0);
});

test('no provider configured → skipped, not thrown', async () => {
  const r = await sendMail(MSG, { env: { EMAIL_ENVIRONMENT: 'production' } });
  assert.equal(r.status, 'skipped');
  assert.equal(r.errorCode, 'provider_unavailable');
});

test('legacy_smtp stream stays SMTP-only until notification sending is live', async () => {
  const calls = fakeProviders();
  const r = await sendMail({ ...MSG, stream: 'legacy_smtp' }, { env: { RESEND_API_KEY: 're_x', EMAIL_ENVIRONMENT: 'production' } });
  assert.equal(r.status, 'skipped');
  assert.equal(calls.length, 0);
});

test('error messages are reduced to safe text', () => {
  assert.equal(maskEmail('bob@example.org'), 'b***@e***.org');
  assert.equal(maskEmail(''), '');
  assert.equal(maskEmail('nope'), '***');
  const s = safeMessage('Rejected bob@example.org see https://x.example/a?token=abc');
  assert.doesNotMatch(s, /bob@|token=abc/);
  assert.equal(classifyError({ statusCode: 429, message: 'slow down' }).code, 'rate_limited');
  assert.equal(classifyError({ statusCode: 500, message: 'x' }).transient, true);
  assert.equal(classifyError({ statusCode: 422, name: 'validation_error', message: 'x' }).code, 'validation_error');
  assert.equal(classifyError(Object.assign(new Error('connect'), { code: 'ECONNRESET' })).code, 'network_error');
});
