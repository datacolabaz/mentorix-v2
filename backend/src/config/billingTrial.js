/** SADƏ (basic) paket — legacy fallback (14 gün).
 * Yeni trial müddəti: billing_settings.trial_duration_days (default 21) və ya
 * env TRIAL_DURATION_DAYS. Attribution + campaign varsa campaign.trial_days.
 * Mövcud mid-trial istifadəçilər: COALESCE(current_period_end, …) sayəsində
 * period_end dəyişmir — yalnız yeni grant-lər yeni gün sayını alır.
 */
const BASIC_TRIAL_DAYS = 14;

module.exports = { BASIC_TRIAL_DAYS };
