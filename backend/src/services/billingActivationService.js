const db = require('../utils/db');
const { normalizePlanSlug } = require('../config/plans');

function normalizeBillingInterval(raw) {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (s === 'year' || s === 'yearly' || s === 'annual' || s === '12m' || s === 'illik' || s === 'il') return 'yearly';
  return 'monthly';
}

/** Payriff callback və ya admin təsdiqi — paket aktivləşdir */
async function activatePlanPayment(client, payment) {
  const userId = payment.user_id;
  const newPlan = normalizePlanSlug(payment.plan);
  const billingInt = normalizeBillingInterval(payment.billing_interval);
  const orderId = payment.external_order_id || payment.id;

  const { rows: subRows } = await client.query(`SELECT plan FROM subscriptions WHERE user_id = $1 LIMIT 1`, [userId]);
  const oldPlan = normalizePlanSlug(subRows[0]?.plan || 'basic');

  await client.query(`UPDATE trials SET is_active = FALSE WHERE user_id = $1`, [userId]).catch(() => {});

  if (billingInt === 'yearly') {
    await client.query(
      `UPDATE subscriptions
       SET plan = $2,
           status = 'active',
           provider = COALESCE(NULLIF(TRIM($3), ''), provider, 'manual'),
           current_period_start = NOW(),
           current_period_end = NOW() + interval '365 days',
           pending_plan = NULL,
           pending_effective_at = NULL,
           updated_at = NOW()
       WHERE user_id = $1`,
      [userId, newPlan, payment.provider || 'manual']
    );
  } else {
    await client.query(
      `UPDATE subscriptions
       SET plan = $2,
           status = 'active',
           provider = COALESCE(NULLIF(TRIM($3), ''), provider, 'manual'),
           current_period_start = NOW(),
           current_period_end = NOW() + interval '30 days',
           pending_plan = NULL,
           pending_effective_at = NULL,
           updated_at = NOW()
       WHERE user_id = $1`,
      [userId, newPlan, payment.provider || 'manual']
    );
  }

  await client.query(
    `INSERT INTO billing_history (user_id, action, old_plan, new_plan, amount_cents, currency, status, provider, external_order_id)
     VALUES ($1, 'upgrade', $2, $3, $4, 'AZN', 'paid', $5, $6)`,
    [userId, oldPlan, newPlan, payment.amount_cents || null, payment.provider || 'manual', String(orderId)]
  );

  return { oldPlan, newPlan };
}

/** Əlavə SMS balansı */
async function activateSmsPayment(client, payment) {
  const userId = payment.user_id;
  const qty = Math.max(1, Math.round(Number(payment.sms_quantity) || 0));
  if (!qty) {
    const err = new Error('SMS miqdarı yanlışdır');
    err.statusCode = 400;
    throw err;
  }

  await client.query(
    `INSERT INTO usage_counters (user_id, students_count, storage_used_mb, storage_used_bytes, sms_used_monthly, sms_period_ym, extra_sms_balance)
     VALUES ($1, 0, 0, 0, 0, to_char((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Baku'), 'YYYY-MM'), 0)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
  await client.query(
    `UPDATE usage_counters
     SET extra_sms_balance = COALESCE(extra_sms_balance, 0) + $2,
         updated_at = NOW()
     WHERE user_id = $1`,
    [userId, qty]
  );

  await client.query(
    `INSERT INTO billing_history (user_id, action, old_plan, new_plan, amount_cents, currency, status, provider, external_order_id)
     VALUES ($1, 'sms_topup', NULL, $2, $3, 'AZN', 'paid', $4, $5)`,
    [userId, `+${qty} SMS`, payment.amount_cents || null, payment.provider || 'manual', String(payment.id)]
  );

  return { sms_quantity: qty };
}

/** Əlavə yaddaş (byte) */
async function activateStoragePayment(client, payment) {
  const userId = payment.user_id;
  const mb = Math.max(1, Math.round(Number(payment.storage_mb) || 0));
  if (!mb) {
    const err = new Error('Yaddaş miqdarı yanlışdır');
    err.statusCode = 400;
    throw err;
  }
  const addBytes = mb * 1024 * 1024;

  await client.query(
    `INSERT INTO usage_counters (user_id, students_count, storage_used_mb, storage_used_bytes, sms_used_monthly, sms_period_ym, extra_sms_balance, extra_storage_bytes)
     VALUES ($1, 0, 0, 0, 0, to_char((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Baku'), 'YYYY-MM'), 0, 0)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
  await client.query(
    `UPDATE usage_counters
     SET extra_storage_bytes = COALESCE(extra_storage_bytes, 0) + $2,
         updated_at = NOW()
     WHERE user_id = $1`,
    [userId, addBytes]
  );

  const histLabel =
    mb >= 1024 && mb % 1024 === 0
      ? `+${mb / 1024} GB Sənəd Yaddaşı`
      : `+${mb} MB Sənəd Yaddaşı`;
  await client.query(
    `INSERT INTO billing_history (user_id, action, old_plan, new_plan, amount_cents, currency, status, provider, external_order_id)
     VALUES ($1, 'storage_topup', NULL, $2, $3, 'AZN', 'paid', $4, $5)`,
    [userId, histLabel, payment.amount_cents || null, payment.provider || 'manual', String(payment.id)]
  );

  return { storage_mb: mb, storage_bytes: addBytes };
}

async function activateBillingPayment(client, payment) {
  const productType = String(payment.product_type || 'plan').toLowerCase();
  if (productType === 'sms') return activateSmsPayment(client, payment);
  if (productType === 'storage') return activateStoragePayment(client, payment);
  return activatePlanPayment(client, payment);
}

/** Ödənişi paid et və məhsulu aktivləşdir (idempotent) */
async function fulfillBillingPayment(paymentId, { reviewedBy = null } = {}) {
  return db.transaction(async (client) => {
    const { rows } = await client.query(
      `SELECT id, user_id, plan, amount_cents, currency, status, provider, payment_method,
              product_type, sms_quantity, storage_mb, billing_interval, external_order_id
       FROM billing_payments
       WHERE id = $1
       FOR UPDATE`,
      [paymentId]
    );
    const payment = rows[0];
    if (!payment) {
      const err = new Error('Ödəniş tapılmadı');
      err.statusCode = 404;
      throw err;
    }
    if (String(payment.status) === 'paid') {
      return { payment, noop: true };
    }
    if (String(payment.status) === 'rejected') {
      const err = new Error('Ödəniş rədd edilib');
      err.statusCode = 400;
      throw err;
    }

    await client.query(
      `UPDATE billing_payments
       SET status = 'paid',
           paid_at = NOW(),
           reviewed_at = CASE WHEN $2::uuid IS NOT NULL THEN NOW() ELSE reviewed_at END,
           reviewed_by = COALESCE($2::uuid, reviewed_by),
           updated_at = NOW()
       WHERE id = $1`,
      [paymentId, reviewedBy]
    );

    const activation = await activateBillingPayment(client, payment);

    if (String(payment.product_type || 'plan') === 'plan') {
      await client.query(
        `INSERT INTO billing_history (user_id, action, old_plan, new_plan, amount_cents, currency, status, provider, external_order_id)
         VALUES ($1, 'payment', NULL, $2, $3, 'AZN', 'paid', $4, $5)`,
        [payment.user_id, payment.plan, payment.amount_cents, payment.provider, payment.external_order_id || payment.id]
      ).catch(() => {});
    }

    return { payment, activation, noop: false };
  });
}

async function rejectBillingPayment(paymentId, { reviewedBy, adminNote } = {}) {
  return db.transaction(async (client) => {
    const { rows } = await client.query(
      `SELECT id, status, user_id, plan, external_order_id, provider
       FROM billing_payments WHERE id = $1 FOR UPDATE`,
      [paymentId]
    );
    const payment = rows[0];
    if (!payment) {
      const err = new Error('Ödəniş tapılmadı');
      err.statusCode = 404;
      throw err;
    }
    if (String(payment.status) === 'paid') {
      const err = new Error('Ödəniş artıq təsdiqlənib');
      err.statusCode = 400;
      throw err;
    }

    await client.query(
      `UPDATE billing_payments
       SET status = 'rejected',
           admin_note = COALESCE($2, admin_note),
           reviewed_at = NOW(),
           reviewed_by = $3,
           updated_at = NOW()
       WHERE id = $1`,
      [paymentId, adminNote || null, reviewedBy || null]
    );

    await client.query(
      `INSERT INTO billing_history (user_id, action, old_plan, new_plan, amount_cents, currency, status, provider, external_order_id)
       VALUES ($1, 'payment', NULL, $2, NULL, 'AZN', 'rejected', $3, $4)`,
      [payment.user_id, payment.plan, payment.provider, payment.external_order_id || payment.id]
    );

    return { payment };
  });
}

module.exports = {
  activatePlanPayment,
  activateSmsPayment,
  activateStoragePayment,
  activateBillingPayment,
  fulfillBillingPayment,
  rejectBillingPayment,
  normalizeBillingInterval,
};
