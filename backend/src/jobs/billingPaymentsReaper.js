const db = require('../utils/db');
const { sendRenewalReminderEmail } = require('../services/emailService');
const { enqueueNotification } = require('../services/notificationQueueService');

async function expireAbandonedBillingPayments() {
  // Mark old pending payments as expired to keep DB clean.
  // Safe even if table doesn't exist yet (migration might be pending).
  try {
    const { rowCount } = await db.query(
      `UPDATE billing_payments
       SET status = 'expired',
           updated_at = NOW()
       WHERE status = 'pending'
         AND (expires_at IS NOT NULL AND expires_at < NOW()
              OR created_at < NOW() - interval '30 minutes')`
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
    const { rows } = await db.query(
      `UPDATE subscriptions
       SET status = 'past_due',
           grace_until = NOW() + interval '2 days',
     