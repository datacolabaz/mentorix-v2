const { normalizePlanSlug } = require('../config/plans');
const { resolveBasicTrialWindow, basicTrialExpired } = require('./basicTrialPeriod');

/**
 * Abunəlik sətri + müddət bitibsə request-time past_due keçidi.
 * Ayrıca faylda saxlanır ki, billing route həmişə düzgün funksiya alsın
 * (billingEntitlements module.exports ilə üst-üstə düşmə riski olmasın).
 */
async function getCurrentPlan(dbConn, userId) {
  const { rows } = await dbConn.query(
    `SELECT plan, status, current_period_start, current_period_end, pending_plan, pending_effective_at, grace_until, created_at
     FROM subscriptions
     WHERE user_id = $1
     LIMIT 1`,
    [userId]
  );
  const r = rows[0] || null;
  const planSlug = String(r?.plan || '').toLowerCase().trim();
  if (planSlug === 'basic') {
    const trial = resolveBasicTrialWindow(r || {});
    const expired = basicTrialExpired(trial.current_period_end);
    return {
      plan: 'basic',
      status: expired ? 'expired' : String(r?.status || 'active'),
      current_period_start: trial.current_period_start,
      current_period_end: trial.current_period_end,
      pending_plan: r?.pending_plan ? normalizePlanSlug(r.pending_plan) : null,
      pending_effective_at: r?.pending_effective_at || null,
      grace_until: null,
    };
  }
  if (r && String(r.status || 'active') === 'active' && r.current_period_end && new Date(r.current_period_end).getTime() < Date.now()) {
    try {
      const { rows: up } = await dbConn.query(
        `UPDATE subscriptions
         SET status = 'past_due',
             grace_until = NOW() + interval '2 days',
             updated_at = NOW()
         WHERE user_id = $1 AND status = 'active'
         RETURNING plan, status, current_period_start, current_period_end, pending_plan, pending_effective_at, grace_until`,
        [userId]
      );
      if (up[0]) {
        return {
          plan: normalizePlanSlug(up[0].plan),
          status: String(up[0].status || 'active'),
          current_period_start: up[0].current_period_start || null,
          current_period_end: up[0].current_period_end || null,
          pending_plan: up[0].pending_plan ? normalizePlanSlug(up[0].pending_plan) : null,
          pending_effective_at: up[0].pending_effective_at || null,
          grace_until: up[0].grace_until || null,
        };
      }
    } catch {
      // ignore
    }
  }
  return r
    ? {
        plan: normalizePlanSlug(r.plan),
        status: String(r.status || 'active'),
        current_period_start: r.current_period_start || null,
        current_period_end: r.current_period_end || null,
        pending_plan: r.pending_plan ? normalizePlanSlug(r.pending_plan) : null,
        pending_effective_at: r.pending_effective_at || null,
        grace_until: r.grace_until || null,
      }
    : {
        plan: 'basic',
        status: 'active',
        current_period_start: null,
        current_period_end: null,
        pending_plan: null,
        pending_effective_at: null,
      };
}

module.exports = getCurrentPlan;
