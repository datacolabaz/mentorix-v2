const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

/**
 * SMS is retired. Guards: the SMS module cannot reach a provider, nothing new imports it, no SMS cron or
 * SMS UI copy comes back, and the retired endpoints answer 410.
 */

const SRC = path.join(__dirname, '..');

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'migrations') continue;
      walk(full, out);
    } else if (name.endsWith('.js') && !name.endsWith('.test.js')) {
      out.push(full);
    }
  }
  return out;
}

const FILES = walk(SRC);
const rel = (f) => path.relative(SRC, f).replace(/\\/g, '/');

test('smsService has no network access, no provider URL and no credentials', () => {
  const file = path.join(SRC, 'services', 'smsService.js');
  const code = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(code, /\bfetch\s*\(|require\(['"](?:https?|axios|node-fetch|undici)['"]\)/);
  assert.doesNotMatch(code, /https?:\/\//);
  assert.doesNotMatch(code, /process\.env/);
});

test('every SMS entry point fails closed with SMS_RETIRED', async () => {
  const sms = require('./smsService');
  for (const fn of ['sendSms', 'sendOtpSms']) {
    // eslint-disable-next-line no-await-in-loop
    const r = await sms[fn]({ to: '+994501234567', message: 'x' });
    assert.equal(r.success, false);
    assert.equal(r.code, 'SMS_RETIRED');
  }
  assert.equal((await sms.sendRawSms()).retired, true);
  assert.equal((await sms.fetchSmsProviderBalance()).retired, true);
  const { checkSmsQuota } = require('./smsQuotaService');
  const q = await checkSmsQuota('00000000-0000-4000-8000-000000000001');
  assert.equal(q.ok, false);
  assert.equal(q.statusCode, 410);
  assert.equal(q.body.code, 'SMS_RETIRED');
});

test('only the legacy (Google-only gated) phone auth paths still import the SMS stub', () => {
  const allowed = new Set([
    'services/smsService.js',
    'services/authService.js',
    'controllers/authController.js',
    'services/operatorInventoryLiveService.js',
  ]);
  const importers = FILES.filter((f) => /require\([^)]*smsService['"]\)/.test(fs.readFileSync(f, 'utf8'))).map(rel);
  for (const f of importers) assert.ok(allowed.has(f), `${f} must not import smsService`);
});

test('no job or notification path calls sendSms; the queue worker retires sms rows', () => {
  for (const f of FILES) {
    const r = rel(f);
    if (!/^(jobs|services|controllers|routes)\//.test(r)) continue;
    if (['services/smsService.js', 'services/authService.js', 'controllers/authController.js'].includes(r)) continue;
    assert.doesNotMatch(fs.readFileSync(f, 'utf8'), /\bsendSms\s*\(|\bsendOtpSms\s*\(/, r);
  }
  const worker = fs.readFileSync(path.join(SRC, 'jobs', 'notificationQueueWorker.js'), 'utf8');
  assert.match(worker, /sms_retired/);
});

test('no SMS cron is registered and the unused SMS limit middleware is gone', () => {
  const app = fs.readFileSync(path.join(SRC, 'app.js'), 'utf8');
  for (const line of app.split('\n').filter((l) => /cron\.schedule/.test(l))) {
    assert.doesNotMatch(line, /sms/i, line);
  }
  assert.equal(fs.existsSync(path.join(SRC, 'middleware', 'smsLimit.js')), false);
  assert.equal(fs.existsSync(path.join(SRC, 'controllers', 'smsLogsController.js')), false);
  const ent = require('../middleware/entitlements');
  assert.equal(ent.enforceSmsLimit, undefined);
});

test('plan features, entitlement messages and plan fallbacks contain no SMS', () => {
  const { buildPlanFeaturesFromLimits } = require('./subscriptionPlansService');
  const { PLANS } = require('../config/plans');
  for (const slug of Object.keys(PLANS)) {
    const lines = buildPlanFeaturesFromLimits({ slug, student_limit: 50, exam_limit: 50, homework_limit: 120, storage_limit_bytes: 20 * 1024 ** 3 });
    assert.doesNotMatch(lines.join(' | '), /SMS|iştirakçı|Yazı:|yazısı/i, slug);
    assert.ok(lines.includes('Google Meet və Zoom linkləri ilə limitsiz canlı dərs planlama'), slug);
    assert.equal(PLANS[slug].sms_monthly, undefined, slug);
  }
  const helpers = require('./billingAlertHelpers');
  assert.equal(helpers.smsUsageLine, undefined);
  const cta = helpers.pickLimitCta({ plan: 'premium', plansMap: { premium: {} }, reachedStorage: false, reachedStudents: false });
  assert.notEqual(cta.action, 'OPEN_SMS_TOPUP');
});

test('retired SMS endpoints answer 410', async () => {
  const smsLogs = require('../routes/smsLogs');
  const billingSrc = fs.readFileSync(path.join(SRC, 'routes', 'billing.js'), 'utf8');
  assert.match(billingSrc, /create-sms-payment[\s\S]{0,200}410/);
  const layer = smsLogs.stack.find((l) => l.route || l.name);
  assert.ok(layer, 'sms-logs router has handlers');
  const { createSmsCheckout } = require('./billingCheckoutService');
  await assert.rejects(() => createSmsCheckout({}), (e) => e.statusCode === 410 && e.code === 'SMS_RETIRED');
});
