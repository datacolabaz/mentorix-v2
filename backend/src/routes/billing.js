const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const db = require('../utils/db');
const { resolveEntitlements, logBillingEvent, getCurrentPlan } = require('../services/billingEntitlements');
const { normalizePlanSlug, PLANS } = require('../config/plans');
const { createOrder, getOrderInfo } = require('../services/payriffService');

function planRank(p) {
  const s = normalizePlanSlug(p);
  if (s === 'business') return 3;
  if (s === 'pro') return 2;
  return 1;
}

function addDaysIso(days) {
  const d = new Date(Date.now() + days * 86400000);
  return d.toISOString();
}

function callbackUrlFromReq(req) {
  const env = String(process.env.PAYRIFF_CALLBACK_URL || '').trim();
  if (env) return env;
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'https').toString().split(',')[0].trim();
  const host = (req.headers['x-forwarded-host'] || req.headers.host || '').toString().split(',')[0].trim();
  if (!host) return null;
  return `${proto}://${host}/api/billing/payriff/callback`;
}

router.get('/status', authenticate, authorize('instructor'), async (req, res) => {
  try {
    const out = await resolveEntitlements(req.user.id);
    res.json({
      plan: out.plan,
      trial: {
        is_active: out.trial.is_active,
      },
      limits: out.limits,
      usage: out.usage,
      remaining: out.remaining,
      status: out.status,
      should_warn: out.should_warn,
      should_block: out.should_block,
      messages: out.messages,
      timezone: out.timezone,
      requirements: out.requirements,
    });
  } catch (err) {
    res.status(err.statusCode || err.status || 500).json({ success: false, message: err.message, code: err.code });
  }
});

router.post('/events', authenticate, authorize('instructor'), async (req, res) => {
  try {
    const { event, context } = req.body || {};
    const ev = String(event || '').trim();
    if (!ev) return res.status(400).json({ success: false, message: 'event tələb olunur' });
    await logBillingEvent(db, { user_id: req.user.id, event: ev, context: context || null });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/create-payment', authenticate, authorize('instructor'), async (req, res) => {
  try {
    const plan = normalizePlanSlug(req.body?.plan);
    if (!PLANS[plan]) return res.status(400).json({ success: false, code: 'PLAN_INVALID', message: 'PLAN_INVALID' });

    const cur = await getCurrentPlan(db, req.user.id);
    const from = normalizePlanSlug(cur.plan);
    if (planRank(plan) <= planRank(from)) {
      return res.status(400).json({ success: false, code: 'PLAN_NOT_UPGRADE', message: 'PLAN_NOT_UPGRADE' });
    }

    const priceAzn = Number(PLANS[plan]?.price_azn || 0) || 0;
    if (!priceAzn) return res.status(500).json({ success: false, code: 'PLAN_PRICE_MISSING', message: 'PLAN_PRICE_MISSING' });

    const callbackUrl = callbackUrlFromReq(req);
    if (!callbackUrl) return res.status(500).json({ success: false, code: 'CALLBACK_URL_MISSING', message: 'CALLBACK_URL_MISSING' });

    const amountCents = Math.round(priceAzn * 100);
    const { rows: ins } = await db.query(
      `INSERT INTO billing_payments (user_id, provider, plan, amount_cents, currency, status)
       VALUES ($1, 'payriff', $2, $3, 'AZN', 'pending')
       RETURNING id`,
      [req.user.id, plan, amountCents]
    );
    const paymentId = ins[0]?.id;

    const order = await createOrder({
      amount: priceAzn,
      currency: 'AZN',
      language: 'AZ',
      description: `Mentorix — ${plan.toUpperCase()} plan (30 days)`,
      callbackUrl,
      metadata: { payment_id: paymentId, user_id: req.user.id, plan },
    });

    const orderId = order?.payload?.orderId || null;
    const paymentUrl = order?.payload?.paymentUrl || null;

    await db.query(
      `UPDATE billing_payments
       SET external_order_id = $2,
           payment_url = $3,
           raw_create_response = $4::jsonb,
           updated_at = NOW()
       WHERE id = $1`,
      [paymentId, orderId, paymentUrl, JSON.stringify(order)]
    );

    await db.query(
      `INSERT INTO billing_history (user_id, action, old_plan, new_plan, amount_cents, currency, status, provider, external_order_id)
       VALUES ($1, 'payment', $2, $3, $4, 'AZN', 'pending', 'payriff', $5)`,
      [req.user.id, from, plan, amountCents, orderId]
    );

    void logBillingEvent(db, { user_id: req.user.id, event: 'payment_intent_created', context: { plan, orderId } });

    return res.json({
      success: true,
      payment: {
        id: paymentId,
        provider: 'payriff',
        plan,
        amount_cents: amountCents,
        currency: 'AZN',
        status: 'pending',
        external_order_id: orderId,
        payment_url: paymentUrl,
      },
    });
  } catch (err) {
    return res.status(err.statusCode || err.status || 500).json({ success: false, message: err.message, code: err.code });
  }
});

router.post('/payriff/callback', async (req, res) => {
  try {
    const body = req.body || {};
    const orderId =
      body?.payload?.orderId ||
      body?.orderId ||
      body?.order_id ||
      body?.data?.orderId ||
      null;
    if (!orderId) return res.status(400).json({ success: false, message: 'orderId missing' });

    // Verify status by fetching the order info from Payriff.
    const info = await getOrderInfo(orderId);
    const paymentStatus = String(info?.payload?.paymentStatus || '').toUpperCase();
    const paid = paymentStatus === 'PAID';

    // Idempotent processing.
    await db.transaction(async (client) => {
      const { rows: existingRows } = await client.query(
        `SELECT id, user_id, plan, status
         FROM billing_payments
         WHERE provider = 'payriff' AND external_order_id = $1
         LIMIT 1`,
        [orderId]
      );
      const existing = existingRows[0] || null;

      if (!existing) {
        // Unknown orderId: store for audit (do not change subscriptions).
        await client.query(
          `INSERT INTO billing_payments (user_id, provider, plan, amount_cents, currency, status, external_order_id, raw_callback)
           VALUES ($1, 'payriff', 'basic', 0, 'AZN', $2, $3, $4::jsonb)`,
          [body?.metadata?.user_id || null, paid ? 'paid' : 'failed', orderId, JSON.stringify({ callback: body, info })]
        );
        return;
      }

      if (String(existing.status) === 'paid') {
        // Already processed.
        await client.query(
          `UPDATE billing_payments SET raw_callback = $2::jsonb, updated_at = NOW() WHERE id = $1`,
          [existing.id, JSON.stringify({ callback: body, info })]
        );
        return;
      }

      if (!paid) {
        await client.query(
          `UPDATE billing_payments
           SET status = 'failed',
               raw_callback = $2::jsonb,
               updated_at = NOW()
           WHERE id = $1`,
          [existing.id, JSON.stringify({ callback: body, info })]
        );
        await client.query(
          `INSERT INTO billing_history (user_id, action, old_plan, new_plan, amount_cents, currency, status, provider, external_order_id)
           VALUES ($1, 'payment', NULL, $2, NULL, 'AZN', 'failed', 'payriff', $3)`,
          [existing.user_id, existing.plan, orderId]
        );
        return;
      }

      // Paid -> activate upgrade immediately (upgrade rule).
      const { rows: subRows } = await client.query(
        `SELECT plan FROM subscriptions WHERE user_id = $1 LIMIT 1`,
        [existing.user_id]
      );
      const oldPlan = normalizePlanSlug(subRows[0]?.plan || 'basic');
      const newPlan = normalizePlanSlug(existing.plan);

      await client.query(
        `UPDATE billing_payments
         SET status = 'paid',
             paid_at = NOW(),
             raw_callback = $2::jsonb,
             updated_at = NOW()
         WHERE id = $1`,
        [existing.id, JSON.stringify({ callback: body, info })]
      );

      // Deactivate trial immediately on paid conversion.
      await client.query(`UPDATE trials SET is_active = FALSE WHERE user_id = $1`, [existing.user_id]).catch(() => {});

      // Upgrade immediate; downgrade scheduled (not used here because create-payment only allows upgrades).
      await client.query(
        `UPDATE subscriptions
         SET plan = $2,
             status = 'active',
             provider = 'payriff',
             current_period_start = NOW(),
             current_period_end = NOW() + interval '30 days',
             pending_plan = NULL,
             pending_effective_at = NULL,
             updated_at = NOW()
         WHERE user_id = $1`,
        [existing.user_id, newPlan]
      );

      await client.query(
        `INSERT INTO billing_history (user_id, action, old_plan, new_plan, amount_cents, currency, status, provider, external_order_id)
         VALUES ($1, 'upgrade', $2, $3, $4, 'AZN', 'paid', 'payriff', $5)`,
        [existing.user_id, oldPlan, newPlan, existing.amount_cents || null, orderId]
      );
    });

    return res.json({ success: true, orderId, paid });
  } catch (err) {
    return res.status(err.statusCode || err.status || 500).json({ success: false, message: err.message, code: err.code });
  }
});

module.exports = router;

