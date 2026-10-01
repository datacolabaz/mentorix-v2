const test = require('node:test');
const assert = require('node:assert/strict');

/**
 * Phase F: producers through notificationService.
 * - transaction-aware variant (savepoint; failure leaves caller's transaction usable)
 * - admin fan-out (all active admins, dedupe across replicas/retries)
 * - templates: az/en/ru, optional sections, templateKey override
 * - activity hooks: deferred, privacy (no score / feedback / answers), stable dedupe keys
 * - partner + admin producers, billing helper, delivery-failure summary, admin login failures
 * DB is an in-memory fake that understands the service's SQL.
 */

const U = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ADMIN_A = U(901);
const ADMIN_B = U(902);
const TEACHER = U(801);
const STUDENT = U(701);
const PARTNER_USER = U(601);

const USERS = {
  [ADMIN_A]: { role: 'admin', locale: 'az' },
  [ADMIN_B]: { role: 'admin', locale: 'en' },
  [TEACHER]: { role: 'instructor', locale: 'az', full_name: 'Leyla Müəllim' },
  [STUDENT]: { role: 'student', locale: 'ru', full_name: 'Aysel Əliyeva' },
  [PARTNER_USER]: { role: 'instructor', locale: 'en', full_name: 'Partner P' },
};

const state = {};
function reset() {
  state.notifications = [];
  state.outbox = [];
  state.queries = [];
  state.handlers = [];
  state.failInsertFor = new Set();
}
reset();

function insertNotification(params) {
  const [userId, title, body, type, , metaJson, category, priority, relType, relId, actor] = params;
  if (state.failInsertFor.has(userId)) {
    const err = new Error('insert failed');
    err.code = '23503';
    throw err;
  }
  const dedupeKey = params[14];
  if (dedupeKey && state.notifications.some((n) => n.user_id === userId && n.dedupe_key === dedupeKey)) return { rows: [] };
  const id = params[17];
  state.notifications.push({
    id,
    user_id: userId,
    title,
    body,
    type,
    meta: JSON.parse(metaJson),
    category,
    priority,
    related_entity_type: relType,
    related_entity_id: relId,
    actor_user_id: actor,
    email_status: params[13],
    dedupe_key: dedupeKey,
  });
  if (params[16]) state.outbox.push({ notification_id: id, user_id: userId });
  return { rows: [{ id, queued: params[16] ? 1 : 0, legacy_queued: 0 }] };
}

async function query(sql, params = []) {
  state.queries.push(sql);
  for (const h of state.handlers) {
    if (h.match.test(sql)) return h.reply(params, sql);
  }
  if (/^\s*(SAVEPOINT|RELEASE SAVEPOINT|ROLLBACK TO SAVEPOINT)/.test(sql)) return { rows: [] };
  if (/SELECT id, role, locale, is_active, deleted_at FROM users/.test(sql)) {
    const u = USERS[params[0]];
    return { rows: u ? [{ id: params[0], role: u.role, locale: u.locale, is_active: true, deleted_at: null }] : [] };
  }
  if (/FROM notification_preferences/.test(sql)) return { rows: [] };
  if (/INSERT INTO notifications/.test(sql)) return insertNotification(params);
  if (/WHERE role = 'admin'/.test(sql)) {
    return { rows: Object.entries(USERS).filter(([, u]) => u.role === 'admin').map(([id]) => ({ id })) };
  }
  throw new Error(`unexpected SQL: ${sql.replace(/\s+/g, ' ').slice(0, 90)}`);
}

const dbId = require.resolve('../utils/db');
require.cache[dbId] = {
  id: dbId,
  filename: dbId,
  loaded: true,
  exports: { query, transaction: async (cb) => cb({ query }) },
};

const svc = require('./notificationService');
const { renderTemplate, templateLocale, TEMPLATES } = require('./notificationTemplates');

const ENV_KEYS = ['EMAIL_ENABLED', 'EMAIL_DRY_RUN', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];
async function withEnv(vars, fn) {
  const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  Object.assign(process.env, vars);
  try {
    return await fn();
  } finally {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

const silence = async (fn) => {
  const orig = console.error;
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.error = orig;
  }
};

/* ---------------- transaction-aware variant ---------------- */

test('createNotification({client, savepoint}) wraps the write in a savepoint and releases it', async () => {
  reset();
  const out = await svc.createNotification(
    { recipientId: STUDENT, category: 'assignment', eventType: 'assignment_returned', params: { assignmentTitle: 'Faiz' }, dedupeKey: 'k1' },
    { client: { query }, savepoint: 'sp_test' },
  );
  assert.equal(out.created, true);
  const sp = state.queries.filter((q) => /SAVEPOINT/.test(q)).map((q) => q.trim());
  assert.deepEqual(sp, ['SAVEPOINT sp_test', 'RELEASE SAVEPOINT sp_test']);
});

test('createNotificationInTransaction never throws: failure rolls back to its savepoint', async () => {
  reset();
  state.failInsertFor.add(STUDENT);
  const out = await silence(() =>
    svc.createNotificationInTransaction({ query }, { recipientId: STUDENT, category: 'assignment', eventType: 'assignment_returned', params: { assignmentTitle: 'X' } }),
  );
  assert.deepEqual([out.created, out.reason, out.errorCode], [false, 'error', '23503']);
  const sp = state.queries.filter((q) => /SAVEPOINT/.test(q)).map((q) => q.trim());
  assert.equal(sp.length, 3);
  assert.match(sp[0], /^SAVEPOINT notification_sp_\d+$/);
  assert.match(sp[1], /^ROLLBACK TO SAVEPOINT notification_sp_\d+$/);
  assert.match(sp[2], /^RELEASE SAVEPOINT notification_sp_\d+$/);
  assert.equal(state.notifications.length, 0);
});

test('savepoint mode requires a client', async () => {
  await assert.rejects(
    svc.createNotification({ recipientId: STUDENT, category: 'system', eventType: 'x_y', title: 'T' }, { savepoint: true }),
    (e) => e.code === 'INVALID_NOTIFICATION',
  );
});

test('inside a savepoint the legacy (pre-214) insert fallback is not attempted', async () => {
  reset();
  state.handlers.push({
    match: /INSERT INTO notifications/,
    reply: () => {
      const err = new Error('column missing');
      err.code = '42703';
      throw err;
    },
  });
  const out = await silence(() =>
    svc.createNotificationInTransaction({ query }, { recipientId: STUDENT, category: 'system', eventType: 'x_y', title: 'T' }),
  );
  assert.equal(out.errorCode, '42703');
  assert.equal(state.queries.filter((q) => /INSERT INTO notifications/.test(q)).length, 1, 'no second (legacy) insert after the abort');
});

/* ---------------- admin fan-out ---------------- */

test('notifyAdmins writes one row per active admin; a retry / second replica creates nothing new', async () => {
  reset();
  const input = { category: 'system', eventType: 'notification_delivery_failed', params: { count: 3, from: '09:00', to: '10:00' }, dedupeKey: 'ndf:1' };
  const first = await svc.notifyAdmins(input);
  const again = await svc.notifyAdmins(input);
  assert.deepEqual(first, { recipients: 2, created: 2 });
  assert.deepEqual(again, { recipients: 2, created: 0 });
  assert.deepEqual(state.notifications.map((n) => n.user_id).sort(), [ADMIN_A, ADMIN_B].sort());
  assert.equal(state.notifications.find((n) => n.user_id === ADMIN_B).title, 'Notification deliveries failed', 'admin B reads English');
});

test('notifyAdmins can exclude the actor', async () => {
  reset();
  const out = await svc.notifyAdmins({ category: 'partner', eventType: 'partner_application_submitted', params: { partnerName: 'P' }, dedupeKey: 'pa:1' }, { excludeUserIds: [ADMIN_A] });
  assert.deepEqual(out, { recipients: 1, created: 1 });
});

/* ---------------- deferred work ---------------- */

test('deferNotification runs after the caller returns and swallows errors', async () => {
  const order = [];
  svc.deferNotification('t', async () => {
    order.push('deferred');
  });
  svc.deferNotification('t', async () => {
    throw new Error('boom');
  });
  order.push('caller');
  await silence(() => svc.flushDeferredNotifications());
  assert.deepEqual(order, ['caller', 'deferred']);
});

/* ---------------- templates ---------------- */

test('templates: Russian is rendered (no longer falls back to Azerbaijani)', () => {
  assert.equal(templateLocale('ru'), 'ru');
  assert.equal(templateLocale('ru-RU'), 'ru');
  assert.equal(templateLocale('fr'), 'az');
  assert.equal(renderTemplate('assignment_returned', 'ru', { assignmentTitle: 'Faiz' }).title, 'Задание возвращено на доработку');
});

test('templates: every template has az, en and ru with the same placeholders', () => {
  for (const [key, byLocale] of Object.entries(TEMPLATES)) {
    const vars = (s) => [...String(s).matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort().join(',');
    for (const loc of ['az', 'en', 'ru']) {
      assert.ok(byLocale[loc]?.title && byLocale[loc]?.body, `${key}.${loc}`);
      assert.equal(vars(byLocale[loc].body), vars(byLocale.az.body), `${key}.${loc} placeholders`);
    }
  }
});

test('templates: optional [[...]] sections drop out when their parameter is empty', () => {
  const withDue = renderTemplate('assignment_new', 'az', { assignmentTitle: 'Faiz', instructorName: 'Leyla', dueDate: '2026-10-05' });
  const without = renderTemplate('assignment_new', 'az', { assignmentTitle: 'Faiz', instructorName: 'Leyla', dueDate: '' });
  assert.equal(withDue.body, '«Faiz» — Leyla təyin etdi. Son tarix: 2026-10-05.');
  assert.equal(without.body, '«Faiz» — Leyla təyin etdi.');
});

test('templateKey renders a different text for the same event type and is stored in meta.i18n', async () => {
  reset();
  await svc.createNotification({
    recipientId: STUDENT,
    category: 'assignment',
    eventType: 'assignment_reminder',
    templateKey: 'assignment_due_soon',
    params: { assignmentTitle: 'Faiz', dueDate: '2026-10-05' },
  });
  const n = state.notifications[0];
  assert.equal(n.type, 'assignment_reminder');
  assert.equal(n.title, 'Напоминание о задании');
  assert.deepEqual(n.meta.i18n.key, 'assignment_due_soon');
});

test('a manual reminder (no template for assignment_reminder) keeps its own localized text', async () => {
  reset();
  await svc.createNotification({ recipientId: STUDENT, category: 'assignment', eventType: 'assignment_reminder', title: 'Reminder', body: 'Custom' });
  assert.deepEqual([state.notifications[0].title, state.notifications[0].body], ['Reminder', 'Custom']);
  assert.equal(state.notifications[0].meta.i18n, undefined);
});

/* ---------------- activity hooks ---------------- */

const hooks = require('./activityNotificationHooks');
const EXAM = U(301);
const RESULT = U(302);
const SA = U(401);
const ASSIGNMENT = U(402);

function hookFixtures({ reviewedAt = '2026-10-01T10:00:00Z' } = {}) {
  state.handlers.push(
    {
      match: /hook_exam_ctx/,
      reply: (p) => ({ rows: [{ exam_title: 'Riyaziyyat KSQ', instructor_id: TEACHER, student_name: p[1] ? USERS[p[1]]?.full_name : null }] }),
    },
    {
      match: /hook_assignment_ctx/,
      reply: () => ({
        rows: [
          {
            id: SA,
            assignment_id: ASSIGNMENT,
            student_id: STUDENT,
            reviewed_at: reviewedAt,
            returned_at: '2026-10-01T11:00:00Z',
            title: 'Faiz məsələləri',
            instructor_id: TEACHER,
            group_id: null,
            student_name: USERS[STUDENT].full_name,
          },
        ],
      }),
    },
  );
}

test('hooks are deferred: the caller returns before anything is written', async () => {
  reset();
  hookFixtures();
  hooks.onAssessmentSubmitted({ examId: EXAM, examResultId: RESULT, studentId: STUDENT, instructorId: TEACHER });
  assert.equal(state.notifications.length, 0, 'nothing written synchronously');
  await svc.flushDeferredNotifications();
  assert.equal(state.notifications.length, 1);
  const n = state.notifications[0];
  assert.deepEqual([n.user_id, n.type, n.dedupe_key, n.category, n.priority], [TEACHER, 'exam_submitted', `exam_submitted:${RESULT}`, 'assessment', 'NORMAL']);
  assert.match(n.body, /Aysel Əliyeva «Riyaziyyat KSQ» imtahanını təqdim etdi/);
});

test('pending manual grading → HIGH, grading category, review text; auto-submit has its own key', async () => {
  reset();
  hookFixtures();
  hooks.onAssessmentSubmitted({ examId: EXAM, examResultId: RESULT, studentId: STUDENT, instructorId: TEACHER, gradingPending: true });
  hooks.onAssessmentAutoSubmitted({ examId: EXAM, examResultId: U(303), studentId: STUDENT, instructorId: TEACHER });
  await svc.flushDeferredNotifications();
  const [sub, auto] = state.notifications;
  assert.deepEqual([sub.priority, sub.category, sub.meta.grading_pending], ['HIGH', 'grading', true]);
  assert.match(sub.body, /yoxlamanızı gözləyir/);
  assert.deepEqual([auto.type, auto.dedupe_key], ['exam_auto_submitted', `exam_expired:${U(303)}`]);
});

test('expired with no answers → one LOW summary per exam per day', async () => {
  reset();
  hookFixtures();
  hooks.onAssessmentExpiredNoAnswers({ examId: EXAM, examResultId: U(1), studentId: STUDENT, instructorId: TEACHER });
  hooks.onAssessmentExpiredNoAnswers({ examId: EXAM, examResultId: U(2), studentId: U(702), instructorId: TEACHER });
  await svc.flushDeferredNotifications();
  assert.equal(state.notifications.length, 1);
  assert.equal(state.notifications[0].priority, 'LOW');
  assert.match(state.notifications[0].dedupe_key, new RegExp(`^exam_expired_no_answers:${EXAM}:\\d{4}-\\d{2}-\\d{2}$`));
});

test('result released → student, with email intent and no score', async () => {
  reset();
  hookFixtures();
  await withEnv({ EMAIL_ENABLED: 'true' }, async () => {
    hooks.onResultReleased({ examId: EXAM, examResultId: RESULT, studentId: STUDENT, instructorId: TEACHER });
    await svc.flushDeferredNotifications();
  });
  const n = state.notifications[0];
  assert.deepEqual([n.user_id, n.type, n.dedupe_key], [STUDENT, 'exam_result_released', `result_released:${EXAM}:${STUDENT}`]);
  assert.equal(state.outbox.length, 1, 'email goes through the outbox');
  assert.doesNotMatch(`${n.title} ${n.body}`, /\d+\s*(bal|\/|%|балл)/i);
});

test('assignment submitted / late: teacher notified once per submission, email intent on', async () => {
  reset();
  hookFixtures();
  hooks.onAssignmentSubmitted({ studentAssignmentId: SA, submissionCount: 1, late: false });
  hooks.onAssignmentSubmitted({ studentAssignmentId: SA, submissionCount: 1, late: false });
  hooks.onAssignmentSubmitted({ studentAssignmentId: SA, submissionCount: 2, late: true });
  await svc.flushDeferredNotifications();
  assert.deepEqual(
    state.notifications.map((n) => [n.user_id, n.type, n.dedupe_key]),
    [
      [TEACHER, 'assignment_submitted', `assignment_submitted:${SA}:1`],
      [TEACHER, 'assignment_late_submitted', `assignment_submitted:${SA}:2`],
    ],
  );
});

test('returned for revision and graded: student notified without feedback text or score', async () => {
  reset();
  hookFixtures();
  hooks.onAssignmentReturnedForRevision({ studentAssignmentId: SA, instructorId: TEACHER, returnedAt: new Date('2026-10-01T11:00:00Z') });
  hooks.onAssignmentGraded({ studentAssignmentId: SA });
  hooks.onAssignmentGraded({ studentAssignmentId: SA });
  await svc.flushDeferredNotifications();
  const [ret, graded] = state.notifications;
  assert.equal(state.notifications.length, 2, 'regrade with the same reviewed_at is deduped');
  assert.deepEqual([ret.type, ret.dedupe_key, ret.priority], ['assignment_returned', `assignment_returned:${SA}:${Date.parse('2026-10-01T11:00:00Z')}`, 'HIGH']);
  assert.deepEqual([graded.type, graded.category, graded.dedupe_key], ['assignment_reviewed', 'grading', `assignment_graded:${SA}:${Date.parse('2026-10-01T10:00:00Z')}`]);
  for (const n of state.notifications) assert.doesNotMatch(n.body, /Bal:|\d+\s*\/\s*\d+/);
});

test('graded hook does nothing when the work has no review yet (late decision only)', async () => {
  reset();
  hookFixtures({ reviewedAt: null });
  hooks.onAssignmentGraded({ studentAssignmentId: SA });
  await svc.flushDeferredNotifications();
  assert.equal(state.notifications.length, 0);
});

/* ---------------- partner + admin producers ---------------- */

test('payout status change notifies the partner once per status; request notifies all admins', async () => {
  reset();
  const PARTNER = U(611);
  const PAYOUT = U(612);
  state.handlers.push(
    { match: /SELECT user_id FROM partners/, reply: () => ({ rows: [{ user_id: PARTNER_USER }] }) },
    { match: /AS name\s+FROM partners/, reply: () => ({ rows: [{ name: 'Partner P' }] }) },
  );
  const payouts = require('./partner/partnerPayoutService');
  const payout = { id: PAYOUT, partner_id: PARTNER, amount_cents: 12345 };
  await payouts.notifyPartnerPayoutStatus(payout, 'approved');
  await payouts.notifyPartnerPayoutStatus(payout, 'paid');
  await payouts.notifyPartnerPayoutStatus(payout, 'paid');
  await payouts.notifyAdminsPayoutRequested(payout, PARTNER);
  const toPartner = state.notifications.filter((n) => n.user_id === PARTNER_USER);
  assert.deepEqual(toPartner.map((n) => [n.type, n.dedupe_key]), [
    ['partner_payout_approved', `partner_payout_approved:${PAYOUT}`],
    ['partner_payout_paid', `partner_payout_paid:${PAYOUT}`],
  ]);
  assert.equal(toPartner[1].body, '123.45 AZN was paid to your account');
  assert.equal(toPartner[1].meta.payout_id, PAYOUT, 'partner dashboard still reads meta.payout_id');
  const toAdmins = state.notifications.filter((n) => n.type === 'partner_payout_requested');
  assert.equal(toAdmins.length, 2);
  assert.ok(toAdmins.every((n) => n.priority === 'HIGH' && n.related_entity_type === 'partner_payout'));
});

test('hourly delivery-failure summary: one per admin per hour bucket, nothing when there were no failures', async () => {
  reset();
  let failed = 4;
  let countSql = null;
  let countParams = null;
  state.handlers.push({
    match: /FROM notification_queue/,
    reply: (p, sql) => ((countSql = sql), (countParams = p), { rows: [{ failed }] }),
  });
  const { runNotificationDeliveryFailureAlerts } = require('../jobs/notificationDeliveryFailureAlerts');
  const now = new Date('2026-10-01T10:05:00Z');
  const a = await runNotificationDeliveryFailureAlerts({ now });
  assert.match(countSql, /status = 'failed' AND channel = 'email'/, 'email deliveries only, like the admin dashboard');
  assert.equal(countParams[2], 'notification_delivery_failed');
  const b = await runNotificationDeliveryFailureAlerts({ now: new Date('2026-10-01T10:30:00Z') });
  assert.deepEqual([a.created, b.created], [2, 0], 'second replica / rerun in the same hour is deduped');
  assert.equal(state.notifications[0].dedupe_key, 'notification_delivery_failed:2026-10-01T09:00:00.000Z');
  assert.match(state.notifications[0].body, /09:00–10:00/);
  failed = 0;
  reset();
  state.handlers.push({ match: /FROM notification_queue/, reply: () => ({ rows: [{ failed: 0 }] }) });
  const c = await runNotificationDeliveryFailureAlerts({ now: new Date('2026-10-01T11:05:00Z') });
  assert.equal(c.created, 0);
  assert.equal(state.notifications.length, 0);
});

test('admin login failures: below threshold only logs; at threshold all admins get one CRITICAL alert per window', async () => {
  reset();
  let count = 4;
  const logged = [];
  state.handlers.push(
    { match: /INSERT INTO auth_events/, reply: (p) => (logged.push(JSON.parse(p[4])), { rows: [] }) },
    { match: /FROM auth_events/, reply: () => ({ rows: [{ n: count }] }) },
  );
  const alerts = require('./adminLoginFailureAlerts');
  const now = new Date('2026-10-01T10:01:00Z');
  const below = await alerts.recordAndMaybeAlert({ userId: ADMIN_A, email: 'boss@example.com', now });
  assert.deepEqual([below.count, below.alerted], [4, false]);
  count = 5;
  await alerts.recordAndMaybeAlert({ userId: ADMIN_A, email: 'boss@example.com', now });
  count = 6;
  await alerts.recordAndMaybeAlert({ userId: ADMIN_A, email: 'boss@example.com', now: new Date('2026-10-01T10:05:00Z') });
  assert.deepEqual(logged.map((m) => m.stage), ['admin_password', 'admin_password', 'admin_password']);
  assert.equal(state.notifications.length, 2, 'one per admin, the 6th failure in the same window is deduped');
  const n = state.notifications[0];
  assert.deepEqual([n.type, n.category, n.priority], ['admin_login_failures', 'security', 'CRITICAL']);
  assert.doesNotMatch(n.body, /boss@example\.com/, 'email is masked');
  assert.match(n.body, /b\*\*\*@e\*\*\*\.com/);
});

test('recordAdminPasswordFailure ignores non-admin accounts', async () => {
  reset();
  const alerts = require('./adminLoginFailureAlerts');
  alerts.recordAdminPasswordFailure({ headers: {} }, { id: TEACHER, role: 'instructor', email: 't@example.com' });
  await svc.flushDeferredNotifications();
  assert.equal(state.queries.length, 0);
});

/* ---------------- billing helper ---------------- */

test('billing helper keeps the 45-day same-text check and adds an entity-scoped dedupe key (no email)', async () => {
  reset();
  let recent = false;
  state.handlers.push({ match: /AND body = \$3/, reply: () => ({ rows: recent ? [{ '?column?': 1 }] : [] }) });
  const { notifyBillingOnce } = require('./billingNotifications');
  const input = { userId: STUDENT, type: 'billing_monthly_2d_student', title: 'Abunəlik bitir', body: 'X', dedupeKey: 'billing_monthly_2d:e1:2026-10-03' };
  await withEnv({ EMAIL_ENABLED: 'true' }, async () => {
    assert.equal(await notifyBillingOnce(input), true);
    assert.equal(await notifyBillingOnce(input), false, 'same entity key → deduped even if the text check misses');
    recent = true;
    assert.equal(await notifyBillingOnce({ ...input, dedupeKey: 'other' }), false, 'legacy 45-day check still applies');
  });
  assert.equal(state.notifications.length, 1);
  assert.equal(state.notifications[0].category, 'billing');
  assert.equal(state.outbox.length, 0, 'billing in-app notifications do not email');
});
