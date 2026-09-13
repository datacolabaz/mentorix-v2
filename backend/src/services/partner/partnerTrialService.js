const db = require('../../utils/db');
const { PARTNER_DEFAULTS } = require('../../config/partnerProgram');
const { getSetting } = require('../billingSettingsService');
const { BASIC_TRIAL_DAYS } = require('../../config/billingTrial');

/**
 * Platform default trial for NEW grants.
 * Priority: env TRIAL_DURATION_DAYS → billing_settings.trial_duration_days → 21 → BASIC_TRIAL_DAYS(14) fallback.
 *
 * Existing mid-trial users: provision paths use COALESCE(current_period_end, NOW()+days),
 * so changing this setting does NOT shorten/extend already-started trials.
 */
async function getConfigurableTrialDays() {
  const envRaw = String(process.env.TRIAL_DURATION_DAYS || '').trim();
  if (envRaw) {
    const n = Math.round(Number(envRaw));
    if (Number.isFinite(n) && n > 0 && n <= 365) return n;
  }
  try {
    const raw = await getSetting('trial_duration_days');
    const n = Math.round(Number(raw));
    if (Number.isFinite(n) && n > 0 && n <= 365) return n;
  } catch {
    // ignore
  }
  return PARTNER_DEFAULTS.trial_days || BASIC_TRIAL_DAYS || 14;
}

/**
 * Trial days for a specific instructor: campaign override if attributed + eligible, else platform default.
 */
async function resolveTrialDaysForUser(userId) {
  const platform = await getConfigurableTrialDays();
  if (!userId) return platform;
  try {
    const { rows } = await db.query(
      `SELECT c.trial_days
       FROM partner_attributions a
       JOIN partner_campaigns c ON c.id = a.campaign_id
       WHERE a.invited_user_id = $1
         AND a.self_referral_blocked = FALSE
         AND a.window_expires_at > NOW()
         AND c.is_active = TRUE
       LIMIT 1`,
      [userId]
    );
    const n = Math.round(Number(rows[0]?.trial_days));
    if (Number.isFinite(n) && n > 0 && n <= 365) return n;
  } catch {
    // partner tables may not exist yet during early migrate
  }
  return platform;
}

module.exports = {
  getConfigurableTrialDays,
  resolveTrialDaysForUser,
};
