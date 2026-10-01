const test = require('node:test');
const assert = require('node:assert/strict');

/**
 * Owner decision: pending SMS top-ups are decided one by one by an admin — "Refund" (refunded + note) or
 * "Convert to credit" — reason required, audited, nothing automatic. DB + audit are stubbed.
 */

const U = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const state = { handlers: [], queries: [], audits: [], auditFails: false };

function q(sql, params = []) {
  const flat = sql.replace(/\s+/g, ' ').trim();
  state.queries.push({ sql: flat, params });
  for (const [re, fn] of state.handlers) if (re.test(flat)) return fn(params, flat);
  throw new Error(`unexpected SQL: ${flat.slice(0, 100)}`);
}
const fakeDb = { query: async (sql, params) => q(sql, params), transaction: async (fn) => fn(fakeDb) };
function stub(rel, exports) {
  const id = require.resolve(rel);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}
stub('../utils/db', fakeDb);
stub('./adminAccessAudit', {
  recordAdminAccess: async (input) => {
    if (state.auditFails) throw Object.assign(new Error('audit down'), { statusCode: 503, code: 'ADMIN_AUDIT_UNAVAILABLE' });
    state.audits.push({ ...input, req: undefined, at: state.queries.length });
  },
});

function reset(handlers = []) {
  state.handlers = handlers;
  state.queries = [];
  state.audits = [];
  state.auditFails = false;
}

const credit = require('./billingCreditService');

function resMock() {
  return {
    statusCode: 200,
    body: null,
    status(c) {
      this.statusCode = c;
      return this;
    },
    json(b) {
      this.body = b;
      return this;
    },
  };
}

test('creditToApply: covers all, or leaves at least 1 AZN for a card/cash step', () => {
  assert.equal(credit.creditToApply(0, 1000), 0);
  assert.equal(credit.creditToApply(1500, 1000), 1000);
  assert.equal(credit.creditToApply(800, 1000), 800);
  assert.equal(credit.creditToApply(950, 1000), 900);
  assert.equal(credit.creditToApply(50, 120), 20);
  assert.equal(credit.creditToApply(50, 100), 0);
});

test('refund: marks refunded with the note, no credit, history row', async () => {
  reset([
    [/FROM billing_payments WHERE id = \$1 FOR UPDATE/, () => ({ rows: [{ id: U(1), user_id: U(9), amount_cents: 1000, currency: 'AZN', status: 'pending', product_type: 'sms', provider: 'manual' }] })],
    [/^UPDATE billing_payments SET status = \$2/, () => ({ rows: [] })],
    [/^INSERT INTO billing_history/, () => ({ rows: [] })],
  ]);
  const out = await credit.decideSmsTopup({ paymentId: U(1), decision: 'refund', adminId: U(50), reason: 'Bank köçürməsi qaytarıldı' });
  assert.equal(out.payment.status, 'refunded');
  assert.equal(out.credit, null);
  const upd = state.queries.find((x) => /^UPDATE billing_payments SET status/.test(x.sql));
  assert.deepEqual(upd.params, [U(1), 'refunded', 'Bank köçürməsi qaytarıldı', U(50)]);
  assert.ok(!state.queries.some((x) => /billing_credits/.test(x.sql)));
  assert.equal(state.queries.find((x) => /billing_history/.test(x.sql)).params[1], 'sms_topup_refund');
});

test('convert to credit: credited + billing_credits row for the full amount', async () => {
  reset([
    [/FOR UPDATE/, () => ({ rows: [{ id: U(2), user_id: U(9), amount_cents: 1800, currency: 'AZN', status: 'expired', product_type: 'sms', provider: 'manual' }] })],
    [/^UPDATE billing_payments SET status = \$2/, () => ({ rows: [] })],
    [/^INSERT INTO billing_credits/, (p) => ({ rows: [{ id: U(70), amount_cents: p[1], remaining_cents: p[1] }] })],
    [/^INSERT INTO billing_history/, () => ({ rows: [] })],
  ]);
  const out = await credit.decideSmsTopup({ paymentId: U(2), decision: 'credit', adminId: U(50), reason: 'Müəllim kredit istədi' });
  assert.equal(out.payment.status, 'credited');
  assert.equal(out.credit.amount_cents, 1800);
  const ins = state.queries.find((x) => /^INSERT INTO billing_credits/.test(x.sql));
  assert.equal(ins.params[0], U(9));
  assert.equal(ins.params[3], U(2), 'source payment recorded (unique: one credit per SMS payment)');
});

test('decision guards: reason required, only SMS rows, only once', async () => {
  await assert.rejects(credit.decideSmsTopup({ paymentId: U(3), decision: 'refund', adminId: U(50), reason: ' ok ' }), (e) => e.code === 'REASON_REQUIRED');
  await assert.rejects(credit.decideSmsTopup({ paymentId: U(3), decision: 'approve', adminId: U(50), reason: 'xxxxxx' }), (e) => e.code === 'INVALID_DECISION');
  reset([[/FOR UPDATE/, () => ({ rows: [{ id: U(3), status: 'pending', product_type: 'plan' }] })]]);
  await assert.rejects(credit.decideSmsTopup({ paymentId: U(3), decision: 'refund', adminId: U(50), reason: 'xxxxxx' }), (e) => e.code === 'NOT_SMS_TOPUP');
  reset([[/FOR UPDATE/, () => ({ rows: [{ id: U(3), status: 'refunded', product_type: 'sms' }] })]]);
  await assert.rejects(credit.decideSmsTopup({ paymentId: U(3), decision: 'credit', adminId: U(50), reason: 'xxxxxx' }), (e) => e.code === 'ALREADY_DECIDED' && e.statusCode === 409);
});

test('admin route: reason validated before audit; audit written before the decision; audit outage blocks it', async () => {
  const ctrl = require('../controllers/adminSmsTopupController');
  const req = (body) => ({ params: { id: U(4) }, body, user: { id: U(50) }, headers: {} });

  reset();
  let res = resMock();
  await ctrl.refundSmsTopup(req({ reason: 'abc' }), res);
  assert.equal(res.statusCode, 400);
  assert.equal(state.audits.length, 0);

  reset([[/SELECT user_id FROM billing_payments/, () => ({ rows: [{ user_id: U(9) }] })]]);
  state.auditFails = true;
  res = resMock();
  await ctrl.convertSmsTopupToCredit(req({ reason: 'Müəllim kredit istədi' }), res);
  assert.equal(res.statusCode, 503);
  assert.ok(!state.queries.some((x) => /FOR UPDATE/.test(x.sql)), 'nothing changes without an audit row');

  reset([
    [/SELECT user_id FROM billing_payments/, () => ({ rows: [{ user_id: U(9) }] })],
    [/FOR UPDATE/, () => ({ rows: [{ id: U(4), user_id: U(9), amount_cents: 1000, status: 'pending', product_type: 'sms' }] })],
    [/^UPDATE billing_payments SET status = \$2/, () => ({ rows: [] })],
    [/^INSERT INTO billing_history/, () => ({ rows: [] })],
  ]);
  res = resMock();
  await ctrl.refundSmsTopup(req({ reason: 'Pul kartına qaytarıldı' }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(state.audits.length, 1);
  const a = state.audits[0];
  assert.equal(a.action, 'billing.sms_topup.refund');
  assert.equal(a.entityType, 'billing_payment');
  assert.equal(a.entityId, U(4));
  assert.equal(a.targetUserId, U(9));
  assert.equal(a.reason, 'Pul kartına qaytarıldı');
  const updIdx = state.queries.findIndex((x) => /^UPDATE billing_payments SET status/.test(x.sql));
  assert.ok(a.at <= updIdx, 'audit precedes the status change');
});

test('credit is reserved FIFO at checkout and the payment amount reduced', async () => {
  const updates = [];
  reset([
    [/FROM billing_credits WHERE user_id = \$1 AND remaining_cents > 0/, () => ({ rows: [{ id: U(71), remaining_cents: 300 }, { id: U(72), remaining_cents: 500 }] })],
    [/^UPDATE billing_credits SET remaining_cents = remaining_cents - \$2/, (p) => (updates.push(p), { rows: [] })],
    [/^INSERT INTO billing_credit_applications/, () => ({ rows: [] })],
    [/^UPDATE billing_payments SET amount_cents = \$2/, () => ({ rows: [] })],
  ]);
  const out = await credit.reserveCreditForPayment({ userId: U(9), paymentId: U(80), amountCents: 1000 });
  assert.deepEqual(out, { appliedCents: 800, amountCents: 200 });
  assert.deepEqual(updates, [[U(71), 300], [U(72), 500]]);
  assert.deepEqual(state.queries.find((x) => /^UPDATE billing_payments SET amount_cents/.test(x.sql)).params, [U(80), 200, 800]);

  reset([[/FROM billing_credits/, () => { throw Object.assign(new Error('missing'), { code: '42P01' }); }]]);
  assert.deepEqual(await credit.reserveCreditForPayment({ userId: U(9), paymentId: U(81), amountCents: 1000 }), { appliedCents: 0, amountCents: 1000 });
});

test('approve/reject of an SMS payment is blocked; the reaper never expires SMS rows', async () => {
  const { fulfillBillingPayment, rejectBillingPayment } = require('./billingActivationService');
  reset([[/FOR UPDATE/, () => ({ rows: [{ id: U(5), user_id: U(9), status: 'pending', product_type: 'sms' }] })]]);
  await assert.rejects(fulfillBillingPayment(U(5), { reviewedBy: U(50) }), (e) => e.code === 'SMS_TOPUP_NEEDS_DECISION');
  await assert.rejects(rejectBillingPayment(U(5), { reviewedBy: U(50) }), (e) => e.code === 'SMS_TOPUP_NEEDS_DECISION');
  assert.ok(!state.queries.some((x) => /^UPDATE billing_payments/.test(x.sql)));

  const { expireAbandonedBillingPayments } = require('../jobs/billingPaymentsReaper');
  reset([
    [/^UPDATE billing_payments SET status = 'expired'/, () => ({ rowCount: 2, rows: [] })],
    [/WITH rel AS/, () => ({ rowCount: 0, rows: [] })],
  ]);
  assert.equal(await expireAbandonedBillingPayments(), 2);
  assert.match(state.queries[0].sql, /COALESCE\(product_type, 'plan'\) <> 'sms'/);
  assert.ok(state.queries.some((x) => /WITH rel AS/.test(x.sql)), 'credit reserved by expired payments is released');
});
