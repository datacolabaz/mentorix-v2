/** Feature flag + defaults for Partner / Referral program. */

function isPartnerProgramEnabled() {
  const raw = String(process.env.PARTNER_PROGRAM_ENABLED ?? '1').trim().toLowerCase();
  if (raw === '0' || raw === 'false' || raw === 'off' || raw === 'no') return false;
  return true;
}

const PARTNER_DEFAULTS = Object.freeze({
  trial_days: 21,
  user_discount_pct: 10,
  /** First N paid months on the original joined package (upgrade forfeits). */
  discount_duration_months: 3,
  commission_pct: 20,
  /**
   * Paid-period window for partner commission.
   * 0 = unlimited / recurring while the referred user keeps paying.
   */
  commission_duration_months: 0,
  attribution_window_days: 90,
  minimum_payout_cents: 500,
  cookie_name: 'mx_partner_ref',
  code_cookie_days: 90,
});

module.exports = {
  isPartnerProgramEnabled,
  PARTNER_DEFAULTS,
};
