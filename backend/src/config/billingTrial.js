/** SADƏ (basic) paket — platform default trial length for NEW grants.
 * Also overridable by: env TRIAL_DURATION_DAYS → billing_settings.trial_duration_days
 * → partner campaign.trial_days when attributed.
 *
 * Mid-trial users: existing current_period_end is kept (COALESCE / resolveBasicTrialWindow).
 * Changing BASIC_TRIAL_DAYS only affects new trials and rows with NULL period_end.
 */
const BASIC_TRIAL_DAYS = 21;

module.exports = { BASIC_TRIAL_DAYS };
