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
         AND (
           (COALESCE(provider, '') = 'manual' AND expires_at IS NOT NULL AND expires_at < NOW())
           OR (
             COALESCE(provider, '') <> 'manual'
             AND (
               (expires_at IS NOT NULL AND expires_at < NOW())
               OR created_at < NOW() - interval '30 minutes'
             )
           )
         )`
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
           updated_at = NOW()
       WHERE status = 'active'
         AND current_period_end IS NOT NULL
         AND current_period_end < NOW()
       RETURNING user_id, current_period_end`
    );
    // Minimal renewal reminder email (fallback channel).
    for (const r of rows || []) {
      const iso = r.current_period_end ? new Date(r.current_period_end).toISOString() : null;
      const period = new Date().toISOString().slice(0, 7);
      const direct = await sendRenewalReminderEmail({ userId: r.user_id, daysLeft: 0, periodEndIso: iso }).catch(() => ({
        skipped: false,
        error: true,
      }));
      if (direct?.skipped || direct?.error) {
        await enqueueNotification({
          channel: 'email',
          event_type: 'subscription_past_due',
          unique_key: `subscription_past_due_${r.user_id}_${period}`,
          user_id: r.user_id,
          to_addr: '__resolve__',
          subject: `Mentorix — Abunə bitdi`,
          body: `Abunənizin müddəti bitib.\nBitmə tarixi: ${iso || '—'}\nPanel → Upgrade/Ödəniş ilə yeniləyin.\n`,
          context: { periodEnd: iso },
        }).catch(() => {});
      }
    }
  } catch {
    // ignore (migration not applied yet)
  }
}

module.exports = { expireAbandonedBillingPayments, markPastDueSubscriptions };

