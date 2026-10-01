const test = require('node:test');
const assert = require('node:assert/strict');

/**
 * Email-first notification triggers added with the SMS retirement: exam reminder, parent result summary,
 * weekly teacher digest, storage 80/100% alerts, signed unsubscribe links and the template catalogue.
 * DB, entitlements and the notification service are stubbed; real email is never sent.
 */

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-unsubscribe-tokens-0123456789';

const U = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const state = { calls: [], handlers: [], ent: new Map() };

const dbId = require.resolve('../utils/db');
const fakeDb = {
  query: async (sql, params = []) => {
    for (const [re, fn] of state.handlers) if (re.test(sql)) return fn(params, sql);
    throw new Error(`unexpected SQL: ${sql.replace(/\s+/g, ' ').slice(0, 90)}`);
  },
  transaction: async (fn) => fn(fakeDb),
};
require.cache[dbId] = { id: dbId, filename: dbId, loaded: true, exports: fakeDb };

const nsId = require.resolve('./notificationService');
require.cache[nsId] = {
  id: nsId,
  filename: nsId,
  loaded: true,
  exports: {
    createNotificationSafe: async (input) => {
      state.calls.push(input);
      return { created: true, id: U(800 + state.calls.length) };
    },
  },
};

const entId = require.resolve('./billingEntitlements');
require.cache[entId] = {
  id: entId,
  filename: entId,
  loaded: true,
  exports: { resolveEntitlements: async (userId) => state.ent.get(userId) },
};

function reset(handlers = []) {
  state.calls = [];
  state.handlers = handlers;
  state.ent = new Map();
}

/* ------------------------------------------------------------------ exam + parent */

test('exam reminder: in-app + email to every assigned student, deduped per start time', async () => {
  const { sendExamStartReminderForExam } = require('./examService');
  const start = '2026-10-10T10:00:00.000Z';
  reset([[/FROM exam_assignments/, () => ({ rows: [{ student_id: U(10) }, { student_id: U(11) }] })]]);
  await sendExamStartReminderForExam({ id: U(500), instructor_id: U(1), title: 'Cəbr', start_time: start, duration_minutes: 45 });
  assert.equal(state.calls.length, 2);
  for (const c of state.calls) {
    assert.equal(c.eventType, 'exam_starting_soon');
    assert.equal(c.category, 'assessment');
    assert.equal(c.email, true);
    assert.equal(c.dedupeKey, `exam_starting_soon:${U(500)}:${Date.parse(start)}`);
    assert.equal(c.params.examTitle, 'Cəbr');
  }
});

test('parent result summary goes to the linked parent account by email, without the score', async () => {
  const { notifyParentExamResultAfterSubmit } = require('./examService');
  reset([
    [
      /JOIN student_profiles sp/,
      () => ({ rows: [{ title: 'Cəbr', notify_students: true, notify_enabled: true, instructor_id: U(1), student_name: 'Aysel', parent_id: U(30) }] }),
    ],
  ]);
  await notifyParentExamResultAfterSubmit(U(500), U(10), 97);
  assert.equal(state.calls.length, 1);
  const c = state.calls[0];
  assert.equal(c.recipientId, U(30));
  assert.equal(c.category, 'parent');
  assert.equal(c.eventType, 'parent_result_summary');
  assert.equal(c.email, true);
  assert.doesNotMatch(JSON.stringify(c.params), /97/);

  reset([[/JOIN student_profiles sp/, () => ({ rows: [] })]]);
  await notifyParentExamResultAfterSubmit(U(500), U(10));
  assert.equal(state.calls.length, 0, 'no linked parent → nothing sent');
});

/* ------------------------------------------------------------------ weekly digest */

test('weekly digest window is the previous Monday–Monday in Baku time', () => {
  const { previousBakuWeek, periodLabel, weekKey } = require('../jobs/weeklyTeacherDigest');
  const w = previousBakuWeek(new Date('2026-10-05T05:00:00Z')); // Monday 09:00 Baku
  assert.equal(w.start.toISOString(), '2026-09-27T20:00:00.000Z'); // Mon 28.09 00:00 Baku
  assert.equal(w.end.toISOString(), '2026-10-04T20:00:00.000Z');
  assert.equal(weekKey(w), '2026-09-28');
  assert.equal(periodLabel(w), '28.09 – 04.10.2026');
});

test('weekly digest: one email per active teacher, skipped when the week had no activity', async () => {
  const { runWeeklyTeacherDigest } = require('../jobs/weeklyTeacherDigest');
  const stats = {
    [U(1)]: { active_students: 12, exam_submissions: 9, assignment_submissions: 4, pending_reviews: 2, live_lessons: 3 },
    [U(2)]: { active_students: 5, exam_submissions: 0, assignment_submissions: 0, pending_reviews: 0, live_lessons: 0 },
  };
  reset([
    [/FROM users\s+WHERE role = 'instructor'/, () => ({ rows: [{ id: U(1) }, { id: U(2) }] })],
    [/AS active_students/, (p) => ({ rows: [stats[p[0]]] })],
  ]);
  const out = await runWeeklyTeacherDigest({ now: new Date('2026-10-05T05:00:00Z') });
  assert.deepEqual(out, { teachers: 2, notified: 1, skipped_no_activity: 1 });
  const c = state.calls[0];
  assert.equal(c.recipientId, U(1));
  assert.equal(c.category, 'digest');
  assert.equal(c.eventType, 'weekly_teacher_digest');
  assert.equal(c.email, true);
  assert.equal(c.dedupeKey, 'weekly_teacher_digest:2026-09-28');
  assert.equal(c.params.examSubmissions, '9');
  assert.equal(c.params.liveLessons, '3');
});

/* ------------------------------------------------------------------ storage alerts */

test('storage alert levels: 80% warning, 100% reached', () => {
  const { storageAlertLevel, formatBytes } = require('../jobs/storageLimitAlerts');
  const GB = 1024 ** 3;
  assert.equal(storageAlertLevel(0.79 * GB, GB), null);
  assert.equal(storageAlertLevel(0.8 * GB, GB), 'warning');
  assert.equal(storageAlertLevel(GB, GB), 'reached');
  assert.equal(storageAlertLevel(5 * GB, null), null, 'unlimited plans never alert');
  assert.equal(formatBytes(20 * GB), '20 GB');
  assert.equal(formatBytes(1.5 * GB), '1.5 GB');
  assert.equal(formatBytes(300 * 1024 * 1024), '300 MB');
});

test('storage alerts: dashboard + email once per level per limit per month', async () => {
  const { runStorageLimitAlerts } = require('../jobs/storageLimitAlerts');
  const GB = 1024 ** 3;
  reset([[/FROM usage_counters uc/, () => ({ rows: [{ user_id: U(1) }, { user_id: U(2) }, { user_id: U(3) }] })]]);
  state.ent.set(U(1), { limits: { storage_limit_bytes: 20 * GB }, usage: { storage_bytes: 17 * GB } });
  state.ent.set(U(2), { limits: { storage_limit_bytes: GB }, usage: { storage_bytes: GB } });
  state.ent.set(U(3), { limits: { storage_limit_bytes: 20 * GB }, usage: { storage_bytes: 2 * GB } });
  const out = await runStorageLimitAlerts({ now: new Date('2026-10-15T10:00:00Z') });
  assert.deepEqual(out, { checked: 3, warning: 1, reached: 1 });
  const [warn, full] = state.calls;
  assert.equal(warn.eventType, 'storage_limit_warning');
  assert.equal(warn.params.percent, '85');
  assert.equal(warn.dedupeKey, `storage_limit_warning:${20 * GB}:2026-10`);
  assert.equal(full.eventType, 'storage_limit_reached');
  assert.equal(full.priority, 'HIGH');
  for (const c of state.calls) {
    assert.equal(c.category, 'billing');
    assert.equal(c.email, true);
  }
});

/* ------------------------------------------------------------------ unsubscribe */

test('unsubscribe token: signed, scoped to user + category, mandatory categories excluded', () => {
  const u = require('./emailUnsubscribe');
  const token = u.createUnsubscribeToken(U(10), 'live_lesson');
  assert.ok(token);
  assert.deepEqual(u.verifyUnsubscribeToken(token), { userId: U(10), category: 'live_lesson' });
  const [payload, sig] = token.split('.');
  const forged = Buffer.from(JSON.stringify({ u: U(11), c: 'live_lesson', v: 1 })).toString('base64url');
  assert.equal(u.verifyUnsubscribeToken(`${forged}.${sig}`), null);
  assert.equal(u.verifyUnsubscribeToken(`${payload}.${sig.slice(0, -2)}xx`), null);
  assert.equal(u.verifyUnsubscribeToken(''), null);
  assert.equal(u.createUnsubscribeToken(U(10), 'security'), null);
  assert.equal(u.createUnsubscribeToken(U(10), 'not_a_category'), null);
  assert.equal(u.createUnsubscribeToken(U(10), 'live_lesson', { JWT_SECRET: '' }), null);
  assert.match(u.unsubscribeUrl(U(10), 'digest', { ...process.env, FRONTEND_PUBLIC_URL: 'https://app.example' }), /^https:\/\/app\.example\/unsubscribe\?token=/);
});

test('applying an unsubscribe turns off only that category email channel', async () => {
  const u = require('./emailUnsubscribe');
  const writes = [];
  reset([
    [/SELECT id FROM users/, () => ({ rows: [{ id: U(10) }] })],
    [/INSERT INTO notification_preferences/, (p) => (writes.push(p), { rows: [] })],
  ]);
  const out = await u.applyUnsubscribe(u.createUnsubscribeToken(U(10), 'digest'));
  assert.deepEqual(out, { ok: true, category: 'digest' });
  assert.deepEqual(writes, [[U(10), 'digest']]);
  assert.deepEqual(await u.applyUnsubscribe('garbage.token'), { ok: false, code: 'INVALID_TOKEN' });
});

/* ------------------------------------------------------------------ template catalogue */

const SPEC_EVENTS = [
  'exam_assigned',
  'exam_starting_soon',
  'exam_result_released',
  'assignment_new',
  'assignment_reminder',
  'assignment_reviewed',
  'live_lesson_created',
  'live_lesson_updated',
  'live_lesson_cancelled',
  'live_lesson_reminder',
  'billing_monthly_2d_student',
  'certificate_status_changed',
  'parent_result_summary',
  'weekly_teacher_digest',
  'storage_limit_warning',
  'storage_limit_reached',
];

test('every spec email event has az/en/ru email copy, no SMS wording and no meeting link', () => {
  const { renderEmail } = require('./email/emailTemplates');
  const params = {
    examTitle: 'Cəbr',
    assignmentTitle: 'Faiz',
    lessonTitle: 'Fizika',
    instructorName: 'Aynur',
    startsAt: '10.10.2026, 14:00',
    platformName: 'Google Meet',
    courseTitle: 'Cəbr',
    statusLabel: 'ləğv olunub',
    studentName: 'Aysel',
    periodLabel: '28.09 – 04.10.2026',
    percent: '85',
    used: '17 GB',
    limit: '20 GB',
  };
  for (const key of SPEC_EVENTS) {
    for (const locale of ['az', 'en', 'ru']) {
      const out = renderEmail(key, locale, params, { ctaUrl: 'https://app.example/notifications?open=1', env: { FRONTEND_PUBLIC_URL: 'https://app.example' } });
      assert.ok(out.subject, `${key}/${locale}`);
      assert.doesNotMatch(`${out.subject}\n${out.text}`, /\bSMS\b|СМС/i, `${key}/${locale}`);
      assert.doesNotMatch(out.text, /meet\.google\.com|zoom\.us/, `${key}/${locale}`);
    }
  }
});

test('in-app templates exist in all locales for the new events', () => {
  const { hasTemplate, TEMPLATES } = require('./notificationTemplates');
  for (const key of [
    'exam_starting_soon',
    'live_lesson_created',
    'live_lesson_updated',
    'live_lesson_cancelled',
    'live_lesson_reminder',
    'certificate_issued',
    'certificate_status_changed',
    'parent_result_summary',
    'weekly_teacher_digest',
    'storage_limit_warning',
    'storage_limit_reached',
  ]) {
    assert.ok(hasTemplate(key), key);
    for (const l of ['az', 'en', 'ru']) assert.ok(TEMPLATES[key][l]?.title, `${key}/${l}`);
  }
});

test('non-mandatory notification emails carry a one-click unsubscribe line', () => {
  const { renderEmail } = require('./email/emailTemplates');
  const out = renderEmail('live_lesson_reminder', 'az', { lessonTitle: 'Fizika', startsAt: 'x', platformName: 'Zoom' }, {
    ctaUrl: 'https://app.example/notifications?open=1',
    unsubscribeUrl: 'https://app.example/unsubscribe?token=abc',
    env: { FRONTEND_PUBLIC_URL: 'https://app.example' },
  });
  assert.match(out.text, /https:\/\/app\.example\/unsubscribe\?token=abc/);
  const bad = renderEmail('live_lesson_reminder', 'az', { lessonTitle: 'Fizika' }, {
    ctaUrl: 'https://app.example/notifications?open=1',
    unsubscribeUrl: 'javascript:alert(1)',
    env: { FRONTEND_PUBLIC_URL: 'https://app.example' },
  });
  assert.doesNotMatch(bad.text + bad.html, /javascript:/);
});
