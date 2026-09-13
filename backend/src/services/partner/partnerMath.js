/**
 * Partner program money math — integer qəpik (cents) only.
 * Pure functions for unit tests (no DB).
 */

function clampPct(pct) {
  const n = Math.round(Number(pct));
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

/** Apply percentage discount to amount_cents; returns { net_cents, discount_cents }. */
function applyDiscountCents(grossCents, discountPct) {
  const gross = Math.max(0, Math.round(Number(grossCents) || 0));
  const pct = clampPct(discountPct);
  const discount = Math.floor((gross * pct) / 100);
  const net = gross - discount;
  return { gross_cents: gross, discount_cents: discount, net_cents: net };
}

/** Commission on net paid amount. */
function computeCommissionCents(netCents, commissionPct) {
  const net = Math.max(0, Math.round(Number(netCents) || 0));
  const pct = clampPct(commissionPct);
  return Math.floor((net * pct) / 100);
}

/**
 * Full split for docs / UI:
 * list → discounted user pay → partner cut → mentorix remainder
 */
function splitPaymentCents(listCents, discountPct, commissionPct) {
  const { gross_cents, discount_cents, net_cents } = applyDiscountCents(listCents, discountPct);
  const commission_cents = computeCommissionCents(net_cents, commissionPct);
  const mentorix_cents = net_cents - commission_cents;
  return {
    list_cents: gross_cents,
    discount_cents,
    user_pays_cents: net_cents,
    commission_cents,
    mentorix_cents,
  };
}

/** period_index is 1-based count of prior paid plan payments for this user + 1 */
function isWithinDurationMonths(periodIndex, durationMonths) {
  const idx = Math.max(1, Math.round(Number(periodIndex) || 1));
  const months = Math.max(0, Math.round(Number(durationMonths) || 0));
  return months > 0 && idx <= months;
}

module.exports = {
  clampPct,
  applyDiscountCents,
  computeCommissionCents,
  splitPaymentCents,
  isWithinDurationMonths,
};
