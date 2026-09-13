const { isPartnerProgramEnabled, PARTNER_DEFAULTS } = require('../../config/partnerProgram');
const { computeCommissionCents, isWithinDurationMonths } = require('./partnerMath');
const { getActiveAttributionForUser, logPartnerAudit } = require('./partnerAttributionService');

/**
 * Count prior paid plan payments for this user (for period_index).
 * Current payment is excluded (caller passes payment before or after mark-paid;
 * we count status='paid' rows with product_type plan — if current already paid, include it as current index).
 */
async function countPaidPlanPayments(client, userId, currentPaymentId) {
  const { rows } = await client.query(
    `SELECT id
     FROM billing_payments
     WHERE user_id = $1
       AND status = 'paid'
       AND COALESCE(product_type, 'plan') = 'plan'
     ORDER BY COALESCE(paid_at, created_at) ASC, created_at ASC`,
    [userId]
  );
  const ids = rows.map((r) => String(r.id));
  const idx = ids.indexOf(String(currentPaymentId));
  if (idx >= 0) return idx + 1;
  return ids.length + 1;
}

/**
 * Called inside fulfillBillingPayment transaction after plan activation when !noop.
 * Idempotent via UNIQUE(billing_payment_id).
 */
async function createPartnerCommissionIfEligible(client, payment, { reviewedBy = null } = {}) {
  if (!isPartnerProgramEnabled()) return { created: false, reason: 'disabled' };
  if (!payment?.id || !payment?.user_id) return { created: false, reason: 'no_payment' };

  const productType = String(payment.product_type || 'plan').toLowerCase();
  if (productType !== 'plan') return { created: false, reason: 'not_plan' };

  // Already commissioned?
  const { rows: existing } = await client.query(
    `SELECT id FROM partner_commissions WHERE billing_payment_id = $1 LIMIT 1`,
    [payment.id]
  );
  if (existing[0]) return { created: false, reason: 'already_exists', commission_id: existing[0].id };

  const attr = await getActiveAttributionForUser(payment.user_id, client);
  if (!attr) return { created: false, reason: 'no_attribution' };

  // Self-referral safety
  if (String(attr.partner_user_id) === String(payment.user_id)) {
    return { created: false, reason: 'self_referral' };
  }

  const periodIndex = await countPaidPlanPayments(client, payment.user_id, payment.id);
  const duration =
    Number(attr.commission_duration_months) || PARTNER_DEFAULTS.commission_duration_months;
  if (!isWithinDurationMonths(periodIndex, duration)) {
    return { created: false, reason: 'outside_commission_window', period_index: periodIndex };
  }

  const gross = Math.max(0, Math.round(Number(payment.amount_cents) || 0));
  // amount_cents on payment is already what user paid (discount applied at checkout).
  // We store discount as 0 here unless we tracked list price; net = gross paid.
  const net = gross;
  const commissionPct = Number(attr.commission_pct) || PARTNER_DEFAULTS.commission_pct;
  const commissionCents = computeCommissionCents(net, commissionPct);

  if (commissionCents <= 0) return { created: false, reason: 'zero_commission' };

  try {
    const { rows } = await client.query(
      `INSERT INTO partner_commissions (
         partner_id, invited_user_id, attribution_id, campaign_id, billing_payment_id,
         period_index, plan, gross_amount_cents, discount_cents, net_amount_cents,
         commission_pct, commission_cents, currency, status
       ) VALUES (
         $1,$2,$3,$4,$5,
         $6,$7,$8,0,$9,
         $10,$11,'AZN','approved'
       )
       RETURNING *`,
      [
        attr.partner_id,
        payment.user_id,
        attr.id,
        attr.campaign_id || null,
        payment.id,
        periodIndex,
        payment.plan || null,
        gross,
        net,
        commissionPct,
        commissionCents,
      ]
    );

    await logPartnerAudit(
      {
        actorUserId: reviewedBy,
        partnerId: attr.partner_id,
        action: 'commission_created',
        entityType: 'partner_commission',
        entityId: rows[0].id,
        context: {
          billing_payment_id: payment.id,
          period_index: periodIndex,
          commission_cents: commissionCents,
        },
      },
      client
    );

    return { created: true, commission: rows[0] };
  } catch (err) {
    // Unique violation → concurrent duplicate approve
    if (err && err.code === '23505') {
      return { created: false, reason: 'race_duplicate' };
    }
    throw err;
  }
}

/**
 * Checkout discount eligibility for attributed user within discount_duration_months.
 */
async function getCheckoutDiscountForUser(client, userId) {
  if (!isPartnerProgramEnabled() || !userId) return null;
  const attr = await getActiveAttributionForUser(userId, client);
  if (!attr) return null;

  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS n
     FROM billing_payments
     WHERE user_id = $1
       AND status = 'paid'
       AND COALESCE(product_type, 'plan') = 'plan'`,
    [userId]
  );
  const paidCount = Number(rows[0]?.n) || 0;
  const nextPeriod = paidCount + 1;
  const duration = Number(attr.discount_duration_months) || PARTNER_DEFAULTS.discount_duration_months;
  if (!isWithinDurationMonths(nextPeriod, duration)) return null;

  const pct = Number(attr.user_discount_pct) || PARTNER_DEFAULTS.user_discount_pct;
  if (pct <= 0) return null;

  return {
    attribution_id: attr.id,
    partner_id: attr.partner_id,
    campaign_id: attr.campaign_id,
    campaign_title: attr.campaign_title,
    discount_pct: pct,
    period_index: nextPeriod,
    discount_duration_months: duration,
  };
}

module.exports = {
  countPaidPlanPayments,
  createPartnerCommissionIfEligible,
  getCheckoutDiscountForUser,
};
