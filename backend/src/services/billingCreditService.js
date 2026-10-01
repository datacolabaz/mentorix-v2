/**
 * Retired SMS top-ups: manual admin decision per payment + account credit.
 *
 * - Pending SMS top-ups are never processed automatically (the reaper skips them, approve is blocked).
 * - An admin decides each one: 'refund' (status 'refunded', money returned outside the app) or
 *   'credit' (status 'credited' + a billing_credits row). Both require a reason and are audited by the
 *   route via recordAdminAccess before anything changes.
 * - Credit is applied FIFO to the teacher's next plan / storage checkout: reserved when the payment is
 *   created, consumed when it is paid, released when it is rejected or expires.
 */
const db = require('../utils/db');

const SMS_DECISIONS = Object.freeze({ refund: 'refunded', credit: 'credited' });
/** Card checkouts below this remainder are impractical; credit then covers all or leaves >= 1 AZN. */
const MIN_REMAINDER_CENTS = 100;

function httpError(message, statusCode, code) {
  return Object.assign(new Error(message), { statusCode, code });
}

function isMissingRelation(e) {
  return e?.code === '42P01' || e?.code === '42703';
}

async function listSmsTopupsForDecision(conn = db) {
  const { rows } = await conn.query(
    `SELECT bp.id, bp.user_id, u.full_name, u.email, bp.amount_cents, bp.currency, bp.status,
            bp.payment_method, bp.provider, bp.sms_quantity, bp.created_at, bp.expires_at
     FROM billing_payments bp
     JOIN users u ON u.id = bp.user_id
     WHERE bp.product_type = 'sms'
       AND (bp.status = 'pending' OR (bp.status = 'expired' AND COALESCE(bp.provider, '') = 'manual'))
     ORDER BY bp.created_at ASC
     LIMIT 500`,
  );
  return rows;
}

/**
 * @param {{ paymentId: string, decision: 'refund'|'credit', adminId: string, reason: string }} input
 */
async function decideSmsTopup({ paymentId, decision, adminId, reason }) {
  const status = SMS_DECISIONS[decision];
  if (!status) throw httpError('Yanlış qərar', 400, 'INVALID_DECISION');
  const note = String(reason || '').trim();
  if (note.length < 5) throw httpError('Səbəb tələb olunur (ən azı 5 simvol)', 400, 'REASON_REQUIRED');

  return db.transaction(async (client) => {
    const { rows } = await client.query(
      `SELECT id, user_id, amount_cents, currency, status, product_type, provider
       FROM billing_payments WHERE id = $1 FOR UPDATE`,
      [paymentId],
    );
    const p = rows[0];
    if (!p) throw httpError('Ödəniş tapılmadı', 404, 'NOT_FOUND');
    if (String(p.product_type) !== 'sms') throw httpError('Bu SMS ödənişi deyil', 400, 'NOT_SMS_TOPUP');
    if (!['pending', 'expired'].includes(String(p.status))) {
      throw httpError('Bu ödəniş üzrə artıq qərar verilib', 409, 'ALREADY_DECIDED');
    }
    const amount = Number(p.amount_cents) || 0;
    if (status === 'credited' && amount <= 0) throw httpError('Məbləğ sıfırdır', 400, 'AMOUNT_ZERO');

    await client.query(
      `UPDATE billing_payments
       SET status = $2, admin_note = $3, reviewed_at = NOW(), reviewed_by = $4, updated_at = NOW()
       WHERE id = $1`,
      [p.id, status, note.slice(0, 500), adminId],
    );
    let credit = null;
    if (status === 'credited') {
      const { rows: c } = await client.query(
        `INSERT INTO billing_credits (user_id, amount_cents, remaining_cents, currency, source, source_payment_id, reason, created_by)
         VALUES ($1, $2, $2, $3, 'sms_topup_conversion', $4, $5, $6)
         RETURNING id, amount_cents, remaining_cents`,
        [p.user_id, amount, p.currency || 'AZN', p.id, note.slice(0, 500), adminId],
      );
      credit = c[0] || null;
    }
    await client.query(
      `INSERT INTO billing_history (user_id, action, old_plan, new_plan, amount_cents, currency, status, provider, external_order_id)
       VALUES ($1, $2, NULL, 'sms', $3, $4, $5, $6, $7)`,
      [p.user_id, status === 'credited' ? 'sms_topup_credit' : 'sms_topup_refund', amount, p.currency || 'AZN', status, p.provider || 'manual', String(p.id)],
    );
    return { payment: { id: p.id, user_id: p.user_id, status, amount_cents: amount }, credit };
  });
}

async function creditBalanceCents(conn, userId) {
  try {
    const { rows } = await conn.query(
      `SELECT COALESCE(SUM(remaining_cents), 0)::int AS cents FROM billing_credits WHERE user_id = $1`,
      [userId],
    );
    return Number(rows[0]?.cents) || 0;
  } catch (e) {
    if (isMissingRelation(e)) return 0;
    throw e;
  }
}

/** How much of `balance` may be applied to `amount` (all of it, or leave >= MIN_REMAINDER_CENTS). */
function creditToApply(balanceCents, amountCents) {
  const bal = Math.max(0, Math.floor(Number(balanceCents) || 0));
  const amt = Math.max(0, Math.floor(Number(amountCents) || 0));
  if (!bal || !amt) return 0;
  if (bal >= amt) return amt;
  return Math.max(0, Math.min(bal, amt - MIN_REMAINDER_CENTS));
}

/**
 * Reserve open credit for a freshly created pending payment (own transaction).
 * @returns {Promise<{ appliedCents: number, amountCents: number }>}
 */
async function reserveCreditForPayment({ userId, paymentId, amountCents }) {
  try {
    return await db.transaction(async (client) => {
      const { rows: credits } = await client.query(
        `SELECT id, remaining_cents FROM billing_credits
         WHERE user_id = $1 AND remaining_cents > 0
         ORDER BY created_at ASC
         FOR UPDATE`,
        [userId],
      );
      const balance = credits.reduce((s, c) => s + (Number(c.remaining_cents) || 0), 0);
      let toApply = creditToApply(balance, amountCents);
      const applied = toApply;
      if (!applied) return { appliedCents: 0, amountCents };
      for (const c of credits) {
        if (toApply <= 0) break;
        const take = Math.min(Number(c.remaining_cents) || 0, toApply);
        if (take <= 0) continue;
        // eslint-disable-next-line no-await-in-loop
        await client.query(
          `UPDATE billing_credits SET remaining_cents = remaining_cents - $2, updated_at = NOW() WHERE id = $1`,
          [c.id, take],
        );
        // eslint-disable-next-line no-await-in-loop
        await client.query(
          `INSERT INTO billing_credit_applications (credit_id, payment_id, amount_cents, status)
           VALUES ($1, $2, $3, 'reserved')`,
          [c.id, paymentId, take],
        );
        toApply -= take;
      }
      const remaining = Math.max(0, amountCents - applied);
      await client.query(
        `UPDATE billing_payments SET amount_cents = $2, credit_applied_cents = $3, updated_at = NOW() WHERE id = $1`,
        [paymentId, remaining, applied],
      );
      return { appliedCents: applied, amountCents: remaining };
    });
  } catch (e) {
    if (isMissingRelation(e)) return { appliedCents: 0, amountCents };
    throw e;
  }
}

async function settleCreditForPayment(client, paymentId, outcome) {
  await client.query('SAVEPOINT billing_credit_settle');
  try {
    if (outcome === 'consumed') {
      await client.query(
        `UPDATE billing_credit_applications SET status = 'consumed', updated_at = NOW()
         WHERE payment_id = $1 AND status = 'reserved'`,
        [paymentId],
      );
      // A late approval of an expired payment whose credit was already released: take it again.
      const { rows: released } = await client.query(
        `SELECT id, credit_id, amount_cents FROM billing_credit_applications
         WHERE payment_id = $1 AND status = 'released'`,
        [paymentId],
      );
      for (const a of released) {
        // eslint-disable-next-line no-await-in-loop
        const { rowCount } = await client.query(
          `UPDATE billing_credits SET remaining_cents = remaining_cents - $2, updated_at = NOW()
           WHERE id = $1 AND remaining_cents >= $2`,
          [a.credit_id, a.amount_cents],
        );
        if (!rowCount) {
          throw httpError('Bu ödənişə tətbiq olunan kredit artıq istifadə olunub — məbləği yoxlayın.', 409, 'CREDIT_NO_LONGER_AVAILABLE');
        }
        // eslint-disable-next-line no-await-in-loop
        await client.query(
          `UPDATE billing_credit_applications SET status = 'consumed', updated_at = NOW() WHERE id = $1`,
          [a.id],
        );
      }
    } else {
      await client.query(
        `WITH rel AS (
           UPDATE billing_credit_applications SET status = 'released', updated_at = NOW()
           WHERE payment_id = $1 AND status = 'reserved'
           RETURNING credit_id, amount_cents
         )
         UPDATE billing_credits c
         SET remaining_cents = c.remaining_cents + r.total, updated_at = NOW()
         FROM (SELECT credit_id, SUM(amount_cents)::int AS total FROM rel GROUP BY credit_id) r
         WHERE c.id = r.credit_id`,
        [paymentId],
      );
    }
    await client.query('RELEASE SAVEPOINT billing_credit_settle');
  } catch (e) {
    await client.query('ROLLBACK TO SAVEPOINT billing_credit_settle').catch(() => {});
    if (!isMissingRelation(e)) throw e;
  }
}

/** Release credit reserved by pending payments that the reaper just expired. */
async function releaseCreditForExpiredPayments(conn = db) {
  try {
    const { rowCount } = await conn.query(
      `WITH rel AS (
         UPDATE billing_credit_applications a SET status = 'released', updated_at = NOW()
         FROM billing_payments bp
         WHERE a.payment_id = bp.id AND a.status = 'reserved' AND bp.status IN ('expired', 'failed', 'rejected')
         RETURNING a.credit_id, a.amount_cents
       )
       UPDATE billing_credits c
       SET remaining_cents = c.remaining_cents + r.total, updated_at = NOW()
       FROM (SELECT credit_id, SUM(amount_cents)::int AS total FROM rel GROUP BY credit_id) r
       WHERE c.id = r.credit_id`,
    );
    return rowCount || 0;
  } catch (e) {
    if (isMissingRelation(e)) return 0;
    throw e;
  }
}

module.exports = {
  SMS_DECISIONS,
  MIN_REMAINDER_CENTS,
  listSmsTopupsForDecision,
  decideSmsTopup,
  creditBalanceCents,
  creditToApply,
  reserveCreditForPayment,
  settleCreditForPayment,
  releaseCreditForExpiredPayments,
};
