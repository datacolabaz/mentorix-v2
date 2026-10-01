const test = require('node:test');
const assert = require('node:assert/strict');

/**
 * Owner decision: Premium storage = 50 GB. Files already above the cap are kept; only NEW uploads are
 * blocked, with an az/en/ru message pointing to deleting files or contacting support.
 */

const { storageLimitMessage, formatStorageBytes } = require('./storageLimitCopy');
const { evaluateMaterialsUpload, MATERIALS_PLAN_LIMITS } = require('../constants/materialsPlanLimits');
const { storageReachedExtras, storageAlertLevel } = require('../jobs/storageLimitAlerts');

const GB = 1024 ** 3;
const PHONE = '+994 50 306 66 26';

test('premium message: az/en/ru, existing files kept, delete or contact support, no upgrade hint', () => {
  const az = storageLimitMessage({ locale: 'az', planSlug: 'premium', usedBytes: 52 * GB, limitBytes: 50 * GB, supportPhone: PHONE });
  assert.match(az, /52 GB \/ 50 GB/);
  assert.match(az, /Mövcud fayllarınız silinmir/);
  assert.match(az, /köhnə faylları silin və ya dəstək ilə əlaqə saxlayın \(\+994 50 306 66 26\)/);
  assert.doesNotMatch(az, /paketə/);

  const en = storageLimitMessage({ locale: 'en-US', planSlug: 'premium', usedBytes: 50 * GB, limitBytes: 50 * GB, supportPhone: PHONE });
  assert.match(en, /existing files are kept/);
  assert.match(en, /delete old files or contact support \(\+994/);
  assert.doesNotMatch(en, /upgrade/i);

  const ru = storageLimitMessage({ locale: 'ru', planSlug: 'premium', usedBytes: 50 * GB, limitBytes: 50 * GB, supportPhone: PHONE });
  assert.match(ru, /Существующие файлы сохраняются/);
  assert.match(ru, /свяжитесь с поддержкой/);
  assert.doesNotMatch(ru, /тариф/);
});

test('lower plans also mention upgrading; unknown locale falls back to az', () => {
  const msg = storageLimitMessage({ locale: 'xx', planSlug: 'growth', usedBytes: 20 * GB, limitBytes: 20 * GB });
  assert.match(msg, /Yaddaş limitinə çatdınız \(20 GB \/ 20 GB\)/);
  assert.match(msg, /Daha geniş paketə/);
  assert.doesNotMatch(msg, /\(\)/, 'no empty phone parentheses when the phone is unknown');
});

test('materials library: premium cap is 50 GB and the block message is localized', () => {
  assert.equal(MATERIALS_PLAN_LIMITS.premium.storageBytes, 50 * GB);
  assert.equal(
    evaluateMaterialsUpload({ planSlug: 'premium', usedBytes: 49 * GB, fileCount: 10, addBytes: 1024 }).allowed,
    true,
  );
  const blocked = evaluateMaterialsUpload({
    planSlug: 'premium',
    usedBytes: 50 * GB,
    fileCount: 10,
    addBytes: 1024,
    locale: 'en',
    supportPhone: PHONE,
  });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.code, 'MATERIALS_STORAGE_LIMIT');
  assert.match(blocked.message, /contact support \(\+994 50 306 66 26\)/);
});

test('storage alerts: 80% warning / 100% reached; premium gets no upgrade hint', () => {
  assert.equal(storageAlertLevel(40 * GB, 50 * GB), 'warning');
  assert.equal(storageAlertLevel(55 * GB, 50 * GB), 'reached', 'users already above 50 GB are "reached", not deleted');
  assert.deepEqual(storageReachedExtras('premium', PHONE), { supportPhone: PHONE, nextPlan: '' });
  assert.equal(storageReachedExtras('growth', PHONE).nextPlan, 'PREMIUM (50 GB)');
});

test('storage_limit_reached copy (in-app + email) points to support and hides the upgrade line on premium', () => {
  const { renderTemplate } = require('../services/notificationTemplates');
  const { renderEmail } = require('../services/email/emailTemplates');
  const base = { used: '52 GB', limit: '50 GB' };
  for (const locale of ['az', 'en', 'ru']) {
    const premium = renderTemplate('storage_limit_reached', locale, { ...base, ...storageReachedExtras('premium', PHONE) });
    assert.match(premium.body, /\+994 50 306 66 26/, locale);
    assert.doesNotMatch(premium.body, /PREMIUM/, locale);
    const growth = renderTemplate('storage_limit_reached', locale, { ...base, ...storageReachedExtras('growth', PHONE) });
    assert.match(growth.body, /PREMIUM \(50 GB\)/, locale);

    const mail = renderEmail('storage_limit_reached', locale, { ...base, ...storageReachedExtras('premium', PHONE) }, {
      env: { FRONTEND_PUBLIC_URL: 'https://app.example' },
    });
    assert.match(mail.text, /\+994 50 306 66 26/, locale);
    assert.doesNotMatch(mail.text, /PREMIUM/, locale);
  }
});

test('formatStorageBytes', () => {
  assert.equal(formatStorageBytes(50 * GB), '50 GB');
  assert.equal(formatStorageBytes(1.5 * GB), '1.5 GB');
  assert.equal(formatStorageBytes(5 * 1024 * 1024), '5 MB');
});
