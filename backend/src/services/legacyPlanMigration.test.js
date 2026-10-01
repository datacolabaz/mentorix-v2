const test = require('node:test');
const assert = require('node:assert/strict');

/**
 * Owner decision: legacy 5 AZN STANDART ('pro') subscribers move to PROFESSIONAL (10 AZN) at their NEXT
 * renewal, never mid-period, only after an advance email + in-app notice (14-day lead time).
 * Billing is manual (no auto-charge), so the move = legacy renewal refused after the notice.
 * DB and the notification service are stubbed; no email is sent.
 */

const U = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const DAY = 86400000;
const NOW = new Date('2026-10-01T06:00:00Z');
const state = { handlers: [], queries: [], calls: [] };

function fakeQuery(sql, params = []) {
  state.queries.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
  for (const [re, fn] of state.handlers) if (re.test(sql)) return fn(params, sql);
  throw new Error(`unexpected SQL: ${sql.replace(/\s+/g, ' ').slice(0, 90)}`);
}
const fakeDb = { query: async (sql, params) => fakeQuery(sql, params), transaction: async (fn) => fn(fakeDb) };

function stub(rel, exports) {
  const id = require.resolve(rel);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}
stub('../utils/db', fakeDb);
stub('./notificationService', {
  createNotificationSafe: async (input) => {
    state.calls.push(input);
    return { created: true, id: U(900 + state.calls.length) };
  },
});

function reset(handlers = []) {
  state.handlers = handlers;
  state.queries = [];
  state.calls = [];
}

const svc = require('./legacyPlanMigrationService');

test('notice window: 14-day lead; shorter notice allows exactly one more monthly 5 AZN renewal', () => {
  assert.deepEqual(svc.noticeDecision({ periodEnd: new Date(NOW.getTime() + 20 * DAY), now: NOW }), { due: false });

  const full = svc.noticeDecision({ periodEnd: new Date(NOW.getTime() + 14.5 * DAY), now: NOW });
  assert.equal(full.due, true);
  assert.equal(full.proRenewalsLeft, 0, 'notified >= 14 days ahead: next renewal is PROFESSIONAL');
  assert.equal(full.effectiveAt.getTime(), NOW.getTime() + 14.5 * DAY, 'effective at period end, never mid-period');

  const short = svc.noticeDecision({ periodEnd: new Date(NOW.getTime() + 5 * DAY), now: NOW });
  assert.equal(short.proRenewalsLeft, 1);
  assert.equal(short.daysLeft, 5);

  const pastDue = svc.noticeDecision({ periodEnd: new Date(NOW.getTime() - 3 * DAY), now: NOW });
  assert.equal(pastDue.proRenewalsLeft, 1);
  assert.equal(pastDue.daysLeft, 0);
});

test('notice job: mandatory billing email + in-app, records the notice only after delivery', async () => {
  const end = new Date(NOW.getTime() + 14.5 * DAY);
  const shortEnd = new Date(NOW.getTime() + 4 * DAY);
  const upserts = [];
  reset([
    [/FROM subscriptions s/, () => ({ rows: [{ user_id: U(1), current_period_end: end }, { user_id: U(2), current_period_end: shortEnd }] })],
    [/INSERT INTO legacy_plan_migrations/, (p) => (upserts.push(p), { rows: [] })],
  ]);
  const out = await svc.runLegacyPlanMigrationNotices({ now: NOW });
  assert.deepEqual(out, { checked: 2, notified: 2, extraRenewal: 1 });
  assert.equal(state.calls.length, 2);
  for (const c of state.calls) {
    assert.equal(c.eventType, 'legacy_plan_migration_notice');
    assert.equal(c.category, 'billing');
    assert.equal(c.email, true);
    assert.equal(c.meta.href, '/instructor/settings#billing-plans');
  }
  assert.equal(state.calls[0].params.effectiveDate, svc.bakuDate(end));
  assert.equal(state.calls[0].params.daysLeft, undefined);
  assert.equal(state.calls[1].params.daysLeft, '4');
  assert.equal(state.calls[1].params.effectiveDate, undefined);
  assert.equal(state.calls[0].dedupeKey, `legacy_plan_migration_notice:${U(1)}:${end.toISOString().slice(0, 10)}`);
  assert.equal(upserts[0][6], 0);
  assert.equal(upserts[1][6], 1);
  const sel = state.queries.find((q) => /FROM subscriptions s/.test(q.sql)).sql;
  assert.match(sel, /LOWER\(s\.plan\) = \$1/);
  assert.match(sel, /status IN \('active', 'past_due'\)/);

  const { isMandatory } = require('../config/notificationPolicy');
  assert.equal(isMandatory({ category: 'billing', eventType: 'legacy_plan_migration_notice' }), true);
});

test('notice job: a failed notification is not recorded (retried next day); missing table is a no-op', async () => {
  reset([[/FROM subscriptions s/, () => ({ rows: [{ user_id: U(3), current_period_end: null }] })]]);
  const ns = require('./notificationService');
  const orig = ns.createNotificationSafe;
  ns.createNotificationSafe = async () => ({ created: false, deduped: false, reason: 'error' });
  try {
    const out = await svc.runLegacyPlanMigrationNotices({ now: NOW });
    assert.equal(out.notified, 0);
    assert.ok(!state.queries.some((q) => /INSERT INTO legacy_plan_migrations/.test(q.sql)));
  } finally {
    ns.createNotificationSafe = orig;
  }
  reset([[/FROM subscriptions s/, () => { throw Object.assign(new Error('missing'), { code: '42P01' }); }]]);
  assert.deepEqual(await svc.runLegacyPlanMigrationNotices({ now: NOW }), { checked: 0, notified: 0, skipped: 'migration_pending' });
});

test('renewal guard: blocked after the notice; one extra renewal honoured; monthly only; lapsed status refused', async () => {
  const row = (r) => [[/FROM legacy_plan_migrations/, () => ({ rows: r ? [r] : [] })]];
  const base = { userId: U(5), subscriptionStatus: 'active', billingInterval: 'monthly' };

  reset(row(null));
  await svc.assertLegacyRenewalAllowed(fakeDb, base);

  reset(row({ notice_sent_at: NOW, pro_renewals_left: 1, applied_at: null }));
  await svc.assertLegacyRenewalAllowed(fakeDb, base);

  reset(row({ notice_sent_at: NOW, pro_renewals_left: 0, applied_at: null }));
  await assert.rejects(svc.assertLegacyRenewalAllowed(fakeDb, base), (e) => e.code === 'LEGACY_PLAN_MIGRATED' && e.statusCode === 409);

  reset(row(null));
  await assert.rejects(
    svc.assertLegacyRenewalAllowed(fakeDb, { ...base, billingInterval: 'yearly' }),
    (e) => e.code === 'LEGACY_PLAN_MONTHLY_ONLY',
  );
  await assert.rejects(
    svc.assertLegacyRenewalAllowed(fakeDb, { ...base, subscriptionStatus: 'canceled' }),
    (e) => e.code === 'PLAN_NOT_AVAILABLE',
  );

  reset([[/FROM legacy_plan_migrations/, () => { throw Object.assign(new Error('missing'), { code: '42P01' }); }]]);
  await svc.assertLegacyRenewalAllowed(fakeDb, base);
});

test('createPlanCheckout refuses a legacy renewal after the notice before any payment row is created', async () => {
  stub('./billingGetCurrentPlan', async () => ({ plan: 'pro', status: 'active', current_period_end: new Date(NOW.getTime() + 3 * DAY) }));
  stub('./subscriptionPlansService', {
    getPlanOrThrow: async (slug) => ({ slug, price_azn: slug === 'pro' ? 5 : 10, is_public: slug !== 'pro' }),
    getActivePlansMap: async () => ({ pro: { price_azn: 5, is_public: false }, growth: { price_azn: 10 } }),
  });
  delete require.cache[require.resolve('./billingCheckoutService')];
  const { createPlanCheckout } = require('./billingCheckoutService');
  reset([[/FROM legacy_plan_migrations/, () => ({ rows: [{ notice_sent_at: NOW, pro_renewals_left: 0, applied_at: null }] })]]);
  await assert.rejects(
    createPlanCheckout({ userId: U(6), plan: 'pro', interval: 'monthly', paymentMethod: 'cash' }),
    (e) => e.code === 'LEGACY_PLAN_MIGRATED',
  );
  assert.ok(!state.queries.some((q) => /INSERT INTO billing_payments/.test(q.sql)));
});

test('activation hook: PROFESSIONAL completes the move; the extra legacy renewal re-arms a fresh notice', async () => {
  reset([[/SAVEPOINT|UPDATE legacy_plan_migrations/, () => ({ rows: [] })]]);
  await svc.onPlanActivated(fakeDb, { userId: U(7), newPlan: 'growth' });
  assert.ok(state.queries.some((q) => /SET applied_at = NOW\(\)/.test(q.sql)));

  reset([[/SAVEPOINT|UPDATE legacy_plan_migrations/, () => ({ rows: [] })]]);
  await svc.onPlanActivated(fakeDb, { userId: U(7), newPlan: 'pro' });
  const upd = state.queries.find((q) => /UPDATE legacy_plan_migrations/.test(q.sql)).sql;
  assert.match(upd, /pro_renewals_left = 0, notice_sent_at = NULL/);
  assert.match(upd, /pro_renewals_left > 0/);

  reset([
    [/^SAVEPOINT|ROLLBACK TO SAVEPOINT/, () => ({ rows: [] })],
    [/UPDATE legacy_plan_migrations/, () => { throw Object.assign(new Error('missing'), { code: '42P01' }); }],
  ]);
  await svc.onPlanActivated(fakeDb, { userId: U(7), newPlan: 'growth' });
  assert.ok(state.queries.some((q) => /ROLLBACK TO SAVEPOINT legacy_plan_migration/.test(q.sql)), 'activation tx survives');
});

test('notice copy exists in az/en/ru (in-app + email) and promises no automatic charge', () => {
  const { renderTemplate } = require('./notificationTemplates');
  const { renderEmail } = require('./email/emailTemplates');
  const full = svc.noticeParams({ proRenewalsLeft: 0, effectiveAt: new Date('2026-10-15T00:00:00Z') }, new Date('2026-10-15T00:00:00Z'));
  const short = svc.noticeParams({ proRenewalsLeft: 1, daysLeft: 4 }, new Date('2026-10-05T00:00:00Z'));
  const noAuto = { az: /Avtomatik ödəniş yoxdur/, en: /no automatic charge/, ru: /Автоматического списания нет/ };
  for (const l of ['az', 'en', 'ru']) {
    const a = renderTemplate('legacy_plan_migration_notice', l, full);
    assert.match(a.body, /PROFESSIONAL/);
    assert.match(a.body, /15\.10\.2026/);
    assert.match(a.body, noAuto[l]);
    assert.doesNotMatch(a.body, /\{\{|\[\[/);
    const b = renderTemplate('legacy_plan_migration_notice', l, short);
    assert.match(b.body, /\b4\b/);
    assert.doesNotMatch(b.body, /\{\{|\[\[/);
    const mail = renderEmail('legacy_plan_migration_notice', l, full, { env: { FRONTEND_PUBLIC_URL: 'https://app.example' } });
    assert.match(mail.subject, /PROFESSIONAL/);
    assert.match(mail.text, noAuto[l]);
  }
});
