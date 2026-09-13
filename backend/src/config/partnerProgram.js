/** Feature flag + defaults for Partner / Referral program. */

function isPartnerProgramEnabled() {
  const raw = String(process.env.PARTNER_PROGRAM_ENABLED ?? '1').trim().toLowerCase();
  if (raw === '0' || raw === 'false' || raw === 'off' || raw === 'no') return false;
  return true;
}

const PARTNER_DEFAULTS = Object.freeze({
  trial_days: 21,
  user_discount_pct: 10,
  discount_duration_months: 3,
  commission_pct: 20,
  commission_duration_months: 3,
  attribution_window_days: 90,
  minimum_payout_cents: 2000,
  cookie_name: 'mx_partner_ref',
  code_cookie_days: 90,
});

module.exports = {
  isPartnerProgramEnabled,
  PARTNER_DEFAULTS,
};
