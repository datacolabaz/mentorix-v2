const test = require('node:test');
const assert = require('node:assert/strict');

const {
  renderEmail,
  emailLocale,
  notificationTemplateKey,
  listTemplates,
  SUPPORTED_EMAIL_LOCALES,
} = require('./emailTemplates');
const { formatDateTime } = require('../../utils/formatDateTime');

const ENV = { FRONTEND_PUBLIC_URL: 'https://app.example' };
const CTA = 'https://app.example/notifications?open=11111111-1111-4111-8111-111111111111';

test('every template renders in az, en and ru with subject, text and html', () => {
  const { notification, transactional } = listTemplates();
  for (const key of [...notification, ...transactional]) {
    for (const locale of SUPPORTED_EMAIL_LOCALES) {
      const out = renderEmail(key, locale, { title: 'T', body: 'B', url: 'https://app.example/x', verifyUrl: 'https://app.example/v' }, {
        ctaUrl: CTA,
        env: ENV,
      });
      assert.ok(out.subject && out.subject.length <= 200, `${key}/${locale} subject`);
      assert.ok(out.text.length > 0, `${key}/${locale} text`);
      assert.match(out.html, new RegExp(`lang="${locale}"`), `${key}/${locale} html lang`);
      assert.doesNotMatch(out.text, /undefined|null|\[object Object\]/, `${key}/${locale} no leaked placeholders`);
    }
  }
});

test('az and en notification email copy + footer + deep link', () => {
  const params = { studentName: 'Aysel', assignmentTitle: 'Faiz', when: formatDateTime('2026-09-29T17:34:00Z', 'az') };
  const az = renderEmail('assignment_submitted', 'az', params, { ctaUrl: CTA, env: ENV });
  assert.equal(az.subject, 'Tapşırıq təslim edildi');
  assert.match(az.text, /Aysel «Faiz» tapşırığını təslim etdi\./);
  assert.match(az.text, /Vaxt: 29\.09\.2026, 21:34/);
  assert.match(az.text, /Ayarları dəyiş: https:\/\/app\.example\/settings\/notifications/);
  assert.match(az.html, /href="https:\/\/app\.example\/notifications\?open=11111111/);

  const en = renderEmail(
    'assignment_submitted',
    'en',
    { ...params, when: formatDateTime('2026-09-29T17:34:00Z', 'en') },
    { ctaUrl: CTA, env: ENV },
  );
  assert.equal(en.subject, 'Assignment submitted');
  assert.match(en.text, /Aysel submitted the assignment “Faiz”\./);
  assert.match(en.text, /Time: Sep 29, 2026, 21:34/);
  assert.match(en.text, /View submission/);
});

test('subjects never carry scores, codes or tokens', () => {
  const reset = renderEmail('password_reset', 'az', { url: 'https://app.example/reset-password?token=RAW_TOKEN', ttlMinutes: 30 }, { env: ENV });
  assert.doesNotMatch(reset.subject, /RAW_TOKEN|token/);
  const verify = renderEmail('email_verification', 'en', { code: '482913', url: 'https://app.example/verify-email?token=T' }, { env: ENV });
  assert.doesNotMatch(verify.subject, /482913/);
  const { notification } = listTemplates();
  for (const key of notification) {
    for (const locale of SUPPORTED_EMAIL_LOCALES) {
      const out = renderEmail(key, locale, { score: '95', percent: '87%', answerKey: 'KEY_B' }, { ctaUrl: CTA, env: ENV });
      assert.doesNotMatch(out.subject, /95|87%|KEY_B/, `${key}/${locale}`);
      // storage_limit_warning legitimately shows the storage percentage in the body (never in the subject).
      const unknown = key === 'storage_limit_warning' ? /95|KEY_B/ : /95|87%|KEY_B/;
      assert.doesNotMatch(out.text, unknown, `${key}/${locale}: unknown params are ignored`);
    }
  }
});

test('missing entity data falls back to neutral wording instead of blanks', () => {
  const out = renderEmail('join_request', 'en', {}, { ctaUrl: CTA, env: ENV });
  assert.match(out.text, /A student wants to join your group “your group”\./);
  const generic = renderEmail('notification_generic', 'az', {}, { ctaUrl: CTA, env: ENV });
  assert.equal(generic.subject, 'Mentorix bildirişi');
});

test('user-provided values are HTML-escaped and CR/LF stripped from subjects', () => {
  const out = renderEmail('notification_generic', 'en', { title: 'Hi\r\nBcc: x@y.z <b>', body: '<script>alert(1)</script>' }, { ctaUrl: CTA, env: ENV });
  assert.doesNotMatch(out.subject, /[\r\n]/);
  assert.doesNotMatch(out.html, /<script>/);
  assert.match(out.html, /&lt;script&gt;/);
});

test('no CTA without a deep link; javascript: links are never rendered', () => {
  const out = renderEmail('join_request', 'az', {}, { env: ENV });
  assert.doesNotMatch(out.html, /Sorğuya bax<\/a>/);
  const bad = renderEmail('password_reset', 'en', { url: 'javascript:alert(1)' }, { env: ENV });
  assert.doesNotMatch(bad.html, /javascript:/);
});

test('locale normalisation and template fallbacks', () => {
  assert.equal(emailLocale('az-AZ'), 'az');
  assert.equal(emailLocale('EN'), 'en');
  assert.equal(emailLocale('ru_RU'), 'ru');
  assert.equal(emailLocale('tr'), 'en');
  assert.equal(emailLocale(null), 'az');
  assert.equal(emailLocale('xx'), 'az');
  assert.equal(notificationTemplateKey('join_request'), 'join_request');
  assert.equal(notificationTemplateKey('grade_published'), 'notification_generic');
  assert.throws(() => renderEmail('nope', 'az'), /unknown email template/);
});

test('brand comes from config, links never point at mentorix.az', () => {
  const out = renderEmail('join_request', 'az', {}, { ctaUrl: CTA, env: {} });
  assert.match(out.text, /Mentorix/);
  assert.doesNotMatch(out.text + out.html, /mentorix\.az/);
  assert.match(out.text, /https:\/\/mentorix\.io\/settings\/notifications/);
});
