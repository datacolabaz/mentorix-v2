const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const db = require('../utils/db');
const {
  resolveEntitlements,
  logBillingEvent,
  assertDowngradeAllowed,
} = require('../services/billingEntitlements');
const getCurrentPlan = require('../services/billingGetCurrentPlan');
const { normalizePlanSlug } = require('../config/plans');
const { getOrderInfo } = require('../services/payriffService');
const { sendPaymentEmail } = require('../services/emailService');
const { enqueueNotification } = require('../services/notificationQueueService');
const {
  createPlanCheckout,
  createSmsCheckout,
  normalizePaymentMethod,
} = require('../services/billingCheckoutService');
const { fulfillBillingPayment } = require('../services/billingActivationService');
const { getBillingConfig } = require('../services/billingSettingsService');

function callbackUrlFromReq(req) {
  const env = String(process.env.PAYRIFF_CALLBACK_URL || '').trim();
  if (env) return env;
  const token = String(process.env.PAYRIFF_CALLBACK_TOKEN || '').trim();
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'https').toString().split(',')[0].trim();
  const host = (req.headers['x-forwarded-host'] || req.headers.host || '').toString().split(',')[0].trim();
  if (!host) return null;
  const qs = token ? `?token=${encodeURIComponent(token)}` : '';
  // Payriff will POST then GET to the same callbackUrl; we handle both in /payriff/return.
  return `${proto}://${host}/api/billing/payriff/return${qs}`;
}

function clientIp(req) {
  const xf = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xf || req.ip || '';
}

function ipAllowed(req) {
  const list = String(process.env.PAYRIFF_CALLBACK_IPS || '').trim();
  if (!list) return true;
  const allowed = list.split(',').map((s) => s.trim()).filter(Boolean);
  const ip = clientIp(req);
  return allowed.includes(ip);
}

function callbackTokenOk(req) {
  const need = String(process.env.PAYRIFF_CALLBACK_TOKEN || '').trim();
  if (!need) return true;
  const got = String(req.query?.token || req.headers['x-payriff-callback-token'] || '').trim();
  return got && got === need;
}

router.get('/status', authenticate, authorize('instructor'), async (req, res) => {
  try {
    const out = await resolveEntitlements(req.user.id);
    res.json({
      plan: out.plan,
      is_highest_tier: out.is_highest_tier,
      pending_topup: out.pending_topup || null,
      pending_plan_slug: out.pending_plan_slug || null,
      subscription: out.subscription || null,
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

router.get('/config', authenticate, authorize('instructor'), async (_req, res) => {
  try {
    const config = await getBillingConfig();
    res.json({ success: true, ...config });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/payments', authenticate, authorize('instructor'), async (req, res) => {
  try {
    const includeAbandoned = String(req.query?.include_abandoned || '').trim() === '1';
    const statusFilter = includeAbandoned
      ? ''
      : `AND status IN ('pending', 'paid', 'rejected')`;
    const { rows } = await db.query(
      `SELECT id, plan, amount_cents, currency, status, payment_method, product_type, sms_quantity,
              provider, billing_interval, COALESCE(paid_at, created_at) AS at, created_at, admin_note
       FROM billing_payments
       WHERE user_id = $1 ${statusFilter}
       ORDER BY created_at DESC
       LIMIT 200`,
      [req.user.id]
    );
    const payments = (rows || []).map((r) => ({
      id: r.id,
      amount: Number(r.amount_cents || 0) / 100,
      plan: r.plan,
      status: r.status,
      payment_method: r.payment_method,
      product_type: r.product_type,
      sms_quantity: r.sms_quantity,
      billing_interval: r.billing_interval,
      provider: r.provider,
      date: r.at ? new Date(r.at).toISOString() : null,
      created_at: r.created_at ? new Date(r.created_at).toISOString() : null,
      admin_note: r.admin_note,
    }));
    res.json({ success: true, payments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** @deprecated — use GET /billing/payments */
router.get('/invoices', authenticate, authorize('instructor'), async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT plan, amount_cents, status, COALESCE(paid_at, created_at) AS at
       FROM billing_payments WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200`,
      [req.user.id]
    );
    const invoices = (rows || []).map((r) => ({
      amount: Number(r.amount_cents || 0) / 100,
      plan: r.plan,
      date: r.at ? new Date(r.at).toISOString() : null,
      status: r.status,
    }));
    res.json({ success: true, invoices });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/select-basic', authenticate, authorize('instructor'), async (req, res) => {
  try {
    const uid = req.user.id
    const cur = await getCurrentPlan(db, uid)
    const from = normalizePlanSlug(cur.plan)
    if (from === 'basic') {
      return res.json({ success: true, plan: 'basic', noop: true })
    }
    await assertDowngradeAllowed(db, uid, 'basic')
    await db.query(
      `UPDATE subscriptions
       SET plan = 'basic',
           status = 'active',
           current_period_start = NOW(),
           current_period_end = NULL,
           grace_until = NULL,
           pending_plan = NULL,
           pending_effective_at = NULL,
           updated_at = NOW()
       WHERE user_id = $1`,
      [uid]
    )
    void logBillingEvent(db, {
      user_id: uid,
      event: 'downgrade_self_basic',
      context: { previous_plan: from },
    })
    return res.json({ success: true, plan: 'basic' })
  } catch (err) {
    return res.status(err.statusCode || err.status || 500).json({ success: false, message: err.message })
  }
})

router.post('/create-payment', authenticate, authorize('instructor'), async (req, res) => {
  try {
    try {
      const { rows: p } = await db.query(
        `SELECT
           COUNT(*) FILTER (WHERE status='pending' AND created_at > NOW() - interval '30 minutes')::int AS pending_30m,
           COUNT(*) FILTER (WHERE status='failed' AND created_at > NOW() - interval '2 hours')::int AS failed_2h
         FROM billing_payments WHERE user_id = $1`,
        [req.user.id]
      );
      const pending30 = Number(p[0]?.pending_30m || 0) || 0;
      const failed2h = Number(p[0]?.failed_2h || 0) || 0;
      if (pending30 >= 3 || failed2h >= 5) {
        await db.query(
          `INSERT INTO risk_logs (user_id, ip, device_id, risk_score, context)
           VALUES ($1, $2, $3, $4, $5::jsonb)`,
          [
            req.user.id,
            clientIp(req),
            String(req.headers['x-device-id'] || ''),
            pending30 >= 3 ? 30 : 20,
            JSON.stringify({ kind: 'billing_abuse', pending30, failed2h }),
          ]
        ).catch(() => {});
      }
    } catch {
      // ignore
    }

    const paymentMethod = normalizePaymentMethod(req.body?.payment_method ?? req.body?.paymentMethod ?? 'card');
    const callbackUrl = paymentMethod === 'cash' ? null : callbackUrlFromReq(req);

    const payment = await createPlanCheckout({
      userId: req.user.id,
      plan: req.body?.plan,
      interval: req.body?.interval ?? req.body?.billing_interval,
      paymentMethod,
      callbackUrl,
    });

    return res.json({ success: true, payment });
  } catch (err) {
    return res.status(err.statusCode || err.status || 500).json({ success: false, message: err.message, code: err.code });
  }
});

router.post('/create-sms-payment', authenticate, authorize('instructor'), async (req, res) => {
  try {
    const paymentMethod = normalizePaymentMethod(req.body?.payment_method ?? req.body?.paymentMethod ?? 'card');
    const callbackUrl = paymentMethod === 'cash' ? null : callbackUrlFromReq(req);
    const payment = await createSmsCheckout({
      userId: req.user.id,
      smsQuantity: req.body?.quantity ?? req.body?.sms_quantity,
      paymentMethod,
      callbackUrl,
    });
    return res.json({ success: true, payment });
  } catch (err) {
    return res.status(err.statusCode || err.status || 500).json({ success: false, message: err.message, code: err.code });
  }
});

async function processPayriffCallback(req, res) {
  try {
    if (!ipAllowed(req)) return res.status(403).json({ success: false, message: 'IP not allowed' });
    if (!callbackTokenOk(req)) return res.status(403).json({ success: false, message: 'Invalid callback token' });

    const body = req.body || {};
    const orderId =
      body?.payload?.orderId ||
      body?.orderId ||
      body?.order_id ||
      body?.data?.orderId ||
      null;
    if (!orderId) return res.status(400).json({ success: false, message: 'orderId missing' });

    // Strict idempotency: if already paid -> 200 no-op (no Payriff call).
    const { rows: paidRows } = await db.query(
      `SELECT id FROM billing_payments WHERE provider='payriff' AND external_order_id=$1 AND status='paid' LIMIT 1`,
      [orderId]
    );
    if (paidRows[0]) return res.json({ success: true, orderId, paid: true, noop: true });

    // Verify status by fetching the order info from Payriff.
    const info = await getOrderInfo(orderId);
    const paymentStatus = String(info?.payload?.paymentStatus || '').toUpperCase();
    const paid = paymentStatus === 'PAID';

    let paymentIdToFulfill = null;

    // Idempotent processing.
    await db.transaction(async (client) => {
      const { rows: existingRows } = await client.query(
        `SELECT id, user_id, plan, status, provider, amount_cents, product_type, sms_quantity,
                COALESCE(NULLIF(TRIM(billing_interval), ''), 'monthly') AS billing_interval,
                external_order_id
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

      await client.query(
        `UPDATE billing_payments SET raw_callback = $2::jsonb, updated_at = NOW() WHERE id = $1`,
        [existing.id, JSON.stringify({ callback: body, info })]
      );
      paymentIdToFulfill = existing.id;
    });

    if (paymentIdToFulfill) {
      await fulfillBillingPayment(paymentIdToFulfill);
    }

    // Email fallback (non-blocking)
    try {
      const { rows } = await db.query(
        `SELECT user_id, plan, amount_cents FROM billing_payments
         WHERE provider='payriff' AND external_order_id=$1
         LIMIT 1`,
        [orderId]
      );
      const r = rows[0];
      if (r) {
        const period = new Date().toISOString().slice(0, 7);
        const unique_key = `payment_${paid ? 'success' : 'fail'}_${r.user_id}_${period}`;
        const direct = await sendPaymentEmail({
          userId: r.user_id,
          plan: r.plan,
          status: paid ? 'paid' : 'failed',
          amountAzn: (Number(r.amount_cents || 0) / 100).toFixed(2),
          orderId,
        }).catch(() => ({ skipped: false, error: true }));

        // If direct sending is skipped/failed, enqueue for retry (idempotent via unique_key).
        if (direct?.skipped || direct?.error) {
          await enqueueNotification({
            channel: 'email',
            event_type: paid ? 'payment_success' : 'payment_fail',
            unique_key,
            user_id: r.user_id,
            to_addr: '__resolve__',
            subject: paid
              ? `Mentorix — Ödəniş təsdiqləndi (${String(r.plan || '').toUpperCase()})`
              : 'Mentorix — Ödəniş alınmadı',
            body: paid
              ? `Ödəniş uğurludur.\nPlan: ${r.plan}\nMəbləğ: ${(Number(r.amount_cents || 0) / 100).toFixed(2)} AZN\nOrder: ${orderId}\n`
              : `Ödəniş alınmadı.\nPlan: ${r.plan}\nMəbləğ: ${(Number(r.amount_cents || 0) / 100).toFixed(2)} AZN\nOrder: ${orderId}\nYenidən cəhd edin: panel → Upgrade.\n`,
            context: { orderId },
          }).catch(() => {});
        }
      }
    } catch {
      // ignore
    }

    return res.json({ success: true, orderId, paid });
  } catch (err) {
    return res.status(err.statusCode || err.status || 500).json({ success: false, message: err.message, code: err.code });
  }
}

router.post('/payriff/callback', processPayriffCallback);

router.all('/payriff/return', async (req, res) => {
  // Payriff usually POSTs payment data then does a GET redirect to the same callbackUrl.
  if (req.method === 'POST') return processPayriffCallback(req, res);
  try {
    // GET: redirect user to frontend success/fail URLs.
    const orderId = String(req.query?.orderId || req.query?.order_id || '').trim();
    const front = String(process.env.FRONTEND_BASE_URL || '').trim().replace(/\/+$/, '');
    const base = front || `${req.protocol}://${req.headers.host}`;
    if (!orderId) return res.redirect(`${base}/payment/fail`);

    const { rows } = await db.query(
      `SELECT status FROM billing_payments WHERE provider='payriff' AND external_order_id=$1 LIMIT 1`,
      [orderId]
    );
    const st = String(rows[0]?.status || '').toLowerCase();
    const ok = st === 'paid';
    return res.redirect(`${base}/payment/${ok ? 'success' : 'fail'}?orderId=${encodeURIComponent(orderId)}`);
  } catch {
    const front = String(process.env.FRONTEND_BASE_URL || '').trim().replace(/\/+$/, '');
    const base = front || `${req.protocol}://${req.headers.host}`;
    return res.redirect(`${base}/payment/fail`);
  }
});

module.exports = router;

