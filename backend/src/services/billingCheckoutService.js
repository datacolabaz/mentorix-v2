const db = require('../utils/db');
const { normalizePlanSlug, planRank } = require('../config/plans');
const getCurrentPlan = require('./billingGetCurrentPlan');
const { getPlanOrThrow, getActivePlansMap } = require('./subscriptionPlansService');
const { createOrder } = require('./payriffService');
const {
  getManualTransferAccount,
  getSmsPacks,
  findSmsPack,
  getStoragePacks,
  findStoragePack,
} = require('./billingSettingsService');
const { normalizeBillingInterval } = require('./billingActivationService');
const { logBillingEvent, assertDowngradeAllowed } = require('./billingEntitlements');

function yearlyTotalFromMonthly(monthlyAzn, discountPct = 0.2) {
  const m = Number(monthlyAzn || 0) || 0;
  const d = Number(discountPct) || 0;
  return Math.round(m * 12 * (1 - Math.min(1, Math.max(0, d))) * 100) / 100;
}

function normalizePaymentMethod(raw) {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (s === 'cash' || s === 'manual' || s === 'bank' || s === 'transfer') return 'cash';
  return 'card';
}

async function createPlanCheckout({
  userId,
  plan: planRaw,
  interval: intervalRaw,
  paymentMethod: paymentMethodRaw,
  callbackUrl,
}) {
  const plan = normalizePlanSlug(planRaw);
  const picked = await getPlanOrThrow(plan);
  const paymentMethod = normalizePaymentMethod(paymentMethodRaw);

  const cur = await getCurrentPlan(db, userId);
  const from = normalizePlanSlug(cur.plan);
  const toRank = planRank(plan);
  const fromRank = planRank(from);

  if (toRank < fromRank) {
    await assertDowngradeAllowed(db, userId, plan);
  } else if (toRank > fromRank) {
    /* upgrade */
  } else if (plan !== from) {
    const err = new Error('PLAN_SAME_TIER');
    err.code = 'PLAN_SAME_TIER';
    err.statusCode = 400;
    throw err;
  }
  /* toRank === fromRank && plan === from → renewal */

  const priceAzn = Number(picked?.price_azn || 0) || 0;
  if (!priceAzn) {
    const err = new Error('PLAN_PRICE_MISSING');
    err.code = 'PLAN_PRICE_MISSING';
    err.statusCode = 500;
    throw err;
  }

  const billingInterval = normalizeBillingInterval(intervalRaw);
  let finalPriceAzn = billingInterval === 'yearly' ? yearlyTotalFromMonthly(priceAzn, 0.2) : priceAzn;

  if (
    toRank > fromRank &&
    billingInterval === 'monthly' &&
    String(process.env.PAYRIFF_PRORATION || '').trim() === '1' &&
    cur?.current_period_end
  ) {
    const endMs = new Date(cur.current_period_end).getTime();
    const nowMs = Date.now();
    if (Number.isFinite(endMs) && endMs > nowMs) {
      const remainingDays = Math.ceil((endMs - nowMs) / 86400000);
      const plansMap = await getActivePlansMap();
      const fromPrice = Number(plansMap[from]?.price_azn || 0) || 0;
      const diff = Math.max(0, priceAzn - fromPrice);
      finalPriceAzn = Math.max(1, Math.round(diff * Math.min(1, Math.max(0, remainingDays / 30)) * 100) / 100);
    }
  }

  const amountCents = Math.round(finalPriceAzn * 100);
  const provider = paymentMethod === 'cash' ? 'manual' : 'payriff';
  const periodLabel = billingInterval === 'yearly' ? '12 ay' : '30 gün';

  const { rows: ins } = await db.query(
    `INSERT INTO billing_payments (
       user_id, provider, plan, amount_cents, currency, status,
       billing_interval, payment_method, product_type
     )
     VALUES ($1, $2, $3, $4, 'AZN', 'pending', $5, $6, 'plan')
     RETURNING id`,
    [userId, provider, plan, amountCents, billingInterval, paymentMethod]
  );
  const paymentId = ins[0]?.id;

  if (paymentMethod === 'cash') {
    await db.query(
      `UPDATE billing_payments
       SET expires_at = NOW() + interval '7 days', updated_at = NOW()
       WHERE id = $1`,
      [paymentId]
    );
    const manualAccount = await getManualTransferAccount();
    await db.query(
      `INSERT INTO billing_history (user_id, action, old_plan, new_plan, amount_cents, currency, status, provider, external_order_id)
       VALUES ($1, 'payment', $2, $3, $4, 'AZN', 'pending', 'manual', $5)`,
      [userId, from, plan, amountCents, String(paymentId)]
    );
    void logBillingEvent(db, {
      user_id: userId,
      event: 'manual_payment_created',
      context: { plan, paymentId, product_type: 'plan' },
    });
    return {
      id: paymentId,
      provider: 'manual',
      payment_method: 'cash',
      product_type: 'plan',
      plan,
      amount_cents: amountCents,
      currency: 'AZN',
      status: 'pending',
      billing_interval: billingInterval,
      manual_transfer_account: manualAccount,
      description: `Mentorix — ${String(picked?.title || plan).trim()} (${periodLabel})`,
    };
  }

  if (!callbackUrl) {
    const err = new Error('CALLBACK_URL_MISSING');
    err.code = 'CALLBACK_URL_MISSING';
    err.statusCode = 500;
    throw err;
  }

  await db.query(
    `UPDATE billing_payments SET expires_at = NOW() + interval '30 minutes' WHERE id = $1`,
    [paymentId]
  );

  const order = await createOrder({
    amount: finalPriceAzn,
    currency: 'AZN',
    language: 'AZ',
    description: `Mentorix — ${String(picked?.title || plan).trim()} (${periodLabel})`,
    callbackUrl,
    metadata: { payment_id: paymentId, user_id: userId, plan, billing_interval: billingInterval },
  });

  const orderId = order?.payload?.orderId || null;
  const paymentUrl = order?.payload?.paymentUrl || null;

  await db.query(
    `UPDATE billing_payments
     SET external_order_id = $2, payment_url = $3, raw_create_response = $4::jsonb, updated_at = NOW()
     WHERE id = $1`,
    [paymentId, orderId, paymentUrl, JSON.stringify(order)]
  );

  await db.query(
    `INSERT INTO billing_history (user_id, action, old_plan, new_plan, amount_cents, currency, status, provider, external_order_id)
     VALUES ($1, 'payment', $2, $3, $4, 'AZN', 'pending', 'payriff', $5)`,
    [userId, from, plan, amountCents, orderId]
  );

  void logBillingEvent(db, { user_id: userId, event: 'payment_intent_created', context: { plan, orderId } });

  return {
    id: paymentId,
    provider: 'payriff',
    payment_method: 'card',
    product_type: 'plan',
    plan,
    amount_cents: amountCents,
    currency: 'AZN',
    status: 'pending',
    external_order_id: orderId,
    payment_url: paymentUrl,
    billing_interval: billingInterval,
  };
}

async function createSmsCheckout({ userId, smsQuantity, paymentMethod: paymentMethodRaw, callbackUrl }) {
  const paymentMethod = normalizePaymentMethod(paymentMethodRaw);
  const packs = await getSmsPacks();
  const pack = findSmsPack(packs, smsQuantity);
  if (!pack) {
    const err = new Error('SMS paketi tapılmadı');
    err.code = 'SMS_PACK_INVALID';
    err.statusCode = 400;
    throw err;
  }

  const cur = await getCurrentPlan(db, userId);
  const planSlug = normalizePlanSlug(cur.plan);
  const finalPriceAzn = Number(pack.price_azn) || 0;
  const amountCents = Math.round(finalPriceAzn * 100);
  const provider = paymentMethod === 'cash' ? 'manual' : 'payriff';

  const { rows: ins } = await db.query(
    `INSERT INTO billing_payments (
       user_id, provider, plan, amount_cents, currency, status,
       payment_method, product_type, sms_quantity
     )
     VALUES ($1, $2, $3, $4, 'AZN', 'pending', $5, 'sms', $6)
     RETURNING id`,
    [userId, provider, planSlug, amountCents, paymentMethod, pack.quantity]
  );
  const paymentId = ins[0]?.id;

  if (paymentMethod === 'cash') {
    await db.query(
      `UPDATE billing_payments SET expires_at = NOW() + interval '7 days', updated_at = NOW() WHERE id = $1`,
      [paymentId]
    );
    const manualAccount = await getManualTransferAccount();
    await db.query(
      `INSERT INTO billing_history (user_id, action, old_plan, new_plan, amount_cents, currency, status, provider, external_order_id)
       VALUES ($1, 'sms_topup', NULL, $2, $3, 'AZN', 'pending', 'manual', $4)`,
      [userId, `+${pack.quantity} SMS`, amountCents, String(paymentId)]
    );
    return {
      id: paymentId,
      provider: 'manual',
      payment_method: 'cash',
      product_type: 'sms',
      sms_quantity: pack.quantity,
      plan: planSlug,
      amount_cents: amountCents,
      currency: 'AZN',
      status: 'pending',
      manual_transfer_account: manualAccount,
      description: `Mentorix — ${pack.label}`,
    };
  }

  if (!callbackUrl) {
    const err = new Error('CALLBACK_URL_MISSING');
    err.code = 'CALLBACK_URL_MISSING';
    err.statusCode = 500;
    throw err;
  }

  await db.query(
    `UPDATE billing_payments SET expires_at = NOW() + interval '30 minutes' WHERE id = $1`,
    [paymentId]
  );

  const order = await createOrder({
    amount: finalPriceAzn,
    currency: 'AZN',
    language: 'AZ',
    description: `Mentorix — ${pack.label}`,
    callbackUrl,
    metadata: {
      payment_id: paymentId,
      user_id: userId,
      product_type: 'sms',
      sms_quantity: pack.quantity,
    },
  });

  const orderId = order?.payload?.orderId || null;
  const paymentUrl = order?.payload?.paymentUrl || null;

  await db.query(
    `UPDATE billing_payments
     SET external_order_id = $2, payment_url = $3, raw_create_response = $4::jsonb, updated_at = NOW()
     WHERE id = $1`,
    [paymentId, orderId, paymentUrl, JSON.stringify(order)]
  );

  await db.query(
    `INSERT INTO billing_history (user_id, action, old_plan, new_plan, amount_cents, currency, status, provider, external_order_id)
     VALUES ($1, 'sms_topup', NULL, $2, $3, 'AZN', 'pending', 'payriff', $4)`,
    [userId, `+${pack.quantity} SMS`, amountCents, orderId]
  );

  return {
    id: paymentId,
    provider: 'payriff',
    payment_method: 'card',
    product_type: 'sms',
    sms_quantity: pack.quantity,
    plan: planSlug,
    amount_cents: amountCents,
    currency: 'AZN',
    status: 'pending',
    external_order_id: orderId,
    payment_url: paymentUrl,
  };
}

async function createStorageCheckout({ userId, storageMb, paymentMethod: paymentMethodRaw, callbackUrl }) {
  const paymentMethod = normalizePaymentMethod(paymentMethodRaw);
  const packs = await getStoragePacks();
  const pack = findStoragePack(packs, storageMb);
  if (!pack) {
    const err = new Error('Yaddaş paketi tapılmadı');
    err.code = 'STORAGE_PACK_INVALID';
    err.statusCode = 400;
    throw err;
  }

  const cur = await getCurrentPlan(db, userId);
  const planSlug = normalizePlanSlug(cur.plan);
  const finalPriceAzn = Number(pack.price_azn) || 0;
  const amountCents = Math.round(finalPriceAzn * 100);
  const provider = paymentMethod === 'cash' ? 'manual' : 'payriff';

  const { rows: ins } = await db.query(
    `INSERT INTO billing_payments (
       user_id, provider, plan, amount_cents, currency, status,
       payment_method, product_type, storage_mb
     )
     VALUES ($1, $2, $3, $4, 'AZN', 'pending', $5, 'storage', $6)
     RETURNING id`,
    [userId, provider, planSlug, amountCents, paymentMethod, pack.quantity_mb]
  );
  const paymentId = ins[0]?.id;

  if (paymentMethod === 'cash') {
    await db.query(
      `UPDATE billing_payments SET expires_at = NOW() + interval '7 days', updated_at = NOW() WHERE id = $1`,
      [paymentId]
    );
    const manualAccount = await getManualTransferAccount();
    await db.query(
      `INSERT INTO billing_history (user_id, action, old_plan, new_plan, amount_cents, currency, status, provider, external_order_id)
       VALUES ($1, 'storage_topup', NULL, $2, $3, 'AZN', 'pending', 'manual', $4)`,
      [userId, pack.label, amountCents, String(paymentId)]
    );
    return {
      id: paymentId,
      provider: 'manual',
      payment_method: 'cash',
      product_type: 'storage',
      storage_mb: pack.quantity_mb,
      plan: planSlug,
      amount_cents: amountCents,
      currency: 'AZN',
      status: 'pending',
      manual_transfer_account: manualAccount,
      description: `Mentorix — ${pack.label}`,
    };
  }

  if (!callbackUrl) {
    const err = new Error('CALLBACK_URL_MISSING');
    err.code = 'CALLBACK_URL_MISSING';
    err.statusCode = 500;
    throw err;
  }

  await db.query(
    `UPDATE billing_payments SET expires_at = NOW() + interval '30 minutes' WHERE id = $1`,
    [paymentId]
  );

  const order = await createOrder({
    amount: finalPriceAzn,
    currency: 'AZN',
    language: 'AZ',
    description: `Mentorix — ${pack.label}`,
    callbackUrl,
    metadata: {
      payment_id: paymentId,
      user_id: userId,
      product_type: 'storage',
      storage_mb: pack.quantity_mb,
    },
  });

  const orderId = order?.payload?.orderId || null;
  const paymentUrl = order?.payload?.paymentUrl || null;

  await db.query(
    `UPDATE billing_payments
     SET external_order_id = $2, payment_url = $3, raw_create_response = $4::jsonb, updated_at = NOW()
     WHERE id = $1`,
    [paymentId, orderId, paymentUrl, JSON.stringify(order)]
  );

  await db.query(
    `INSERT INTO billing_history (user_id, action, old_plan, new_plan, amount_cents, currency, status, provider, external_order_id)
     VALUES ($1, 'storage_topup', NULL, $2, $3, 'AZN', 'pending', 'payriff', $4)`,
    [userId, pack.label, amountCents, orderId]
  );

  return {
    id: paymentId,
    provider: 'payriff',
    payment_method: 'card',
    product_type: 'storage',
    storage_mb: pack.quantity_mb,
    plan: planSlug,
    amount_cents: amountCents,
    currency: 'AZN',
    status: 'pending',
    external_order_id: orderId,
    payment_url: paymentUrl,
  };
}

module.exports = {
  createPlanCheckout,
  createSmsCheckout,
  createStorageCheckout,
  normalizePaymentMethod,
  planRank,
};
