const db = require('../utils/db');

async function expireAbandonedBillingPayments() {
  // Mark old pending payments as expired to keep DB clean.
  // Safe even if table doesn't exist yet (migration might be pending).
  try {
    const { rowCount } = await db.query(
      `UPDATE billing_payments
       SET status = 'expired',
           updated_at = NOW()
       WHERE status = 'pending'
         AND created_at < NOW() - interval '30 minutes'`
    );
    return rowCount || 0;
  } catch (e) {
    if (/billing_payments/i.test(String(e.message || ''))) return 0;
    // Ignore missing table errors during early deploys/migrations.
    return 0;
  }
}

async function markPastDueSubscriptions() {
  try {
    await db.query(
      `UPDATE subscriptions
       SET status = 'past_due',
           updated_at = NOW()
       WHERE status = 'active'
         AND current_period_end IS NOT NULL
         AND current_period_end < NOW()`
    );
  } catch {
    // ignore (migration not applied yet)
  }
}

module.exports = { expireAbandonedBillingPayments, markPastDueSubscriptions };

