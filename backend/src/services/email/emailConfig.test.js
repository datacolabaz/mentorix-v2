const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PRECEDENCE,
  getEmailConfig,
  transactionalMode,
  notificationMode,
  streamMode,
  providerOrder,
  appLink,
  describeEmailConfig,
} = require('./emailConfig');

test('legacy Railway names alone keep working (nothing to change in Railway)', () => {
  const cfg = getEmailConfig({
    RESEND_API_KEY: 're_legacy',
    VERIFY_EMAIL_FROM: 'Mentorix <notifications@mentorix.io>',
    FRONTEND_BASE_URL: 'https://mentorix.io/',
    NODE_ENV: 'production',
  });
  assert.equal(cfg.resend.apiKey, 're_legacy');
  assert.equal(cfg.resend.apiKeySource, 'RESEND_API_KEY');
  assert.equal(cfg.from, 'Mentorix <notifications@mentorix.io>');
  assert.equal(cfg.fromSource, 'VERIFY_EMAIL_FROM');
  assert.equal(cfg.frontendPublicUrl, 'https://mentorix.io');
  assert.equal(cfg.frontendPublicUrlSource, 'FRONTEND_BASE_URL');
  assert.equal(cfg.environment.isProduction, true);
  assert.equal(transactionalMode(cfg), 'live');
  assert.equal(notificationMode(cfg), 'off');
});

test('spec names win over legacy names when both are set', () => {
  const cfg = getEmailConfig({
    EMAIL_PROVIDER_API_KEY: 're_new',
    RESEND_API_KEY: 're_legacy',
    EMAIL_FROM: 'Resulio <hello@resulio.example>',
    VERIFY_EMAIL_FROM: 'Mentorix <notifications@mentorix.io>',
    EMAIL_REPLY_TO: 'support@mentorix.io',
    FRONTEND_PUBLIC_URL: 'https://app.example',
    FRONTEND_BASE_URL: 'https://old.example',
    FRONTEND_URL: 'https://older.example',
    EMAIL_ENVIRONMENT: 'staging',
    RAILWAY_ENVIRONMENT_NAME: 'production',
    NODE_ENV: 'production',
  });
  assert.equal(cfg.resend.apiKey, 're_new');
  assert.equal(cfg.from, 'Resulio <hello@resulio.example>');
  assert.equal(cfg.replyTo, 'support@mentorix.io');
  assert.equal(cfg.frontendPublicUrl, 'https://app.example');
  assert.equal(cfg.environment.name, 'staging');
  assert.equal(cfg.environment.source, 'EMAIL_ENVIRONMENT');
  assert.deepEqual(cfg.conflicts, ['EMAIL_FROM differs from VERIFY_EMAIL_FROM; EMAIL_FROM is used']);
});

test('precedence table is the documented one', () => {
  assert.deepEqual(PRECEDENCE.apiKey, ['EMAIL_PROVIDER_API_KEY', 'RESEND_API_KEY']);
  assert.deepEqual(PRECEDENCE.from, ['EMAIL_FROM', 'VERIFY_EMAIL_FROM']);
  assert.deepEqual(PRECEDENCE.frontendPublicUrl.slice(0, 3), ['FRONTEND_PUBLIC_URL', 'FRONTEND_BASE_URL', 'FRONTEND_URL']);
  assert.deepEqual(PRECEDENCE.environment, ['EMAIL_ENVIRONMENT', 'RAILWAY_ENVIRONMENT_NAME', 'RAILWAY_ENVIRONMENT', 'NODE_ENV']);
});

test('empty / whitespace / non-http values fall through to the next name', () => {
  const cfg = getEmailConfig({
    EMAIL_PROVIDER_API_KEY: '   ',
    RESEND_API_KEY: 're_x',
    FRONTEND_PUBLIC_URL: 'mentorix.io',
    FRONTEND_BASE_URL: '',
    FRONTEND_URL: 'https://fallback.example',
  });
  assert.equal(cfg.resend.apiKey, 're_x');
  assert.equal(cfg.frontendPublicUrl, 'https://fallback.example');
});

test('no URL configured → brand domain, never mentorix.az', () => {
  const cfg = getEmailConfig({});
  assert.equal(cfg.frontendPublicUrl, 'https://mentorix.io');
  assert.doesNotMatch(cfg.frontendPublicUrl, /mentorix\.az/);
  assert.equal(appLink('/notifications?open=x', {}), 'https://mentorix.io/notifications?open=x');
  assert.equal(appLink('settings', { FRONTEND_PUBLIC_URL: 'https://a.example/' }), 'https://a.example/settings');
});

test('environment inference: Railway name, NODE_ENV fallback, unknown when nothing set', () => {
  assert.equal(getEmailConfig({ RAILWAY_ENVIRONMENT_NAME: 'production' }).environment.isProduction, true);
  assert.equal(getEmailConfig({ RAILWAY_ENVIRONMENT: 'prod' }).environment.isProduction, true);
  assert.equal(getEmailConfig({ NODE_ENV: 'development' }).environment.explicitNonProduction, true);
  const unknown = getEmailConfig({});
  assert.equal(unknown.environment.name, 'unknown');
  assert.equal(unknown.environment.isProduction, false);
  assert.equal(unknown.environment.explicitNonProduction, false);
});

test('transactional mode: live in production and when unknown; dry-run on flag or non-production', () => {
  assert.equal(transactionalMode(getEmailConfig({ NODE_ENV: 'production' })), 'live');
  assert.equal(transactionalMode(getEmailConfig({})), 'live', 'no signal → keep today\'s behaviour');
  assert.equal(transactionalMode(getEmailConfig({ NODE_ENV: 'production', EMAIL_DRY_RUN: 'true' })), 'dry_run');
  assert.equal(transactionalMode(getEmailConfig({ EMAIL_ENVIRONMENT: 'staging', NODE_ENV: 'production' })), 'dry_run');
  assert.equal(transactionalMode(getEmailConfig({ NODE_ENV: 'test' })), 'dry_run');
});

test('notification mode needs all three opt-ins for real sending', () => {
  const prod = { EMAIL_ENVIRONMENT: 'production' };
  assert.equal(notificationMode(getEmailConfig({ ...prod })), 'off');
  assert.equal(notificationMode(getEmailConfig({ ...prod, EMAIL_ENABLED: 'true' })), 'dry_run');
  assert.equal(notificationMode(getEmailConfig({ ...prod, EMAIL_ENABLED: 'true', EMAIL_DRY_RUN: 'yes' })), 'dry_run');
  assert.equal(notificationMode(getEmailConfig({ ...prod, EMAIL_ENABLED: 'true', EMAIL_DRY_RUN: 'false' })), 'live');
  assert.equal(notificationMode(getEmailConfig({ EMAIL_ENABLED: 'true', EMAIL_DRY_RUN: 'false' })), 'dry_run', 'unknown env');
  assert.equal(notificationMode(getEmailConfig({ EMAIL_ENABLED: 'true', EMAIL_DRY_RUN: '0', NODE_ENV: 'staging' })), 'dry_run');
  assert.equal(notificationMode(getEmailConfig({ ...prod, EMAIL_ENABLED: 'maybe', EMAIL_DRY_RUN: 'false' })), 'off');
  assert.equal(streamMode(getEmailConfig({ ...prod }), 'notification'), 'dry_run', 'off never sends');
});

test('legacy SMTP stream does not start using Resend until notification sending is live', () => {
  const base = { RESEND_API_KEY: 're_x', EMAIL_ENVIRONMENT: 'production' };
  assert.deepEqual(providerOrder(getEmailConfig(base), 'legacy_smtp'), []);
  assert.deepEqual(providerOrder(getEmailConfig({ ...base, SMTP_HOST: 'h', SMTP_USER: 'u', SMTP_PASS: 'p' }), 'legacy_smtp'), ['smtp']);
  assert.deepEqual(
    providerOrder(getEmailConfig({ ...base, EMAIL_ENABLED: 'true', EMAIL_DRY_RUN: 'false' }), 'legacy_smtp'),
    ['resend'],
  );
  assert.deepEqual(providerOrder(getEmailConfig({ ...base, SMTP_HOST: 'h', SMTP_USER: 'u', SMTP_PASS: 'p' }), 'transactional'), [
    'resend',
    'smtp',
  ]);
});

test('boot description carries no secrets', () => {
  const d = describeEmailConfig({
    RESEND_API_KEY: 're_super_secret',
    SMTP_HOST: 'h',
    SMTP_USER: 'u',
    SMTP_PASS: 'pass_secret',
    NODE_ENV: 'production',
  });
  const s = JSON.stringify(d);
  assert.doesNotMatch(s, /re_super_secret|pass_secret/);
  assert.equal(d.transactional, 'live');
  assert.equal(d.notifications, 'off');
  assert.equal(d.resend_key_from, 'RESEND_API_KEY');
});
