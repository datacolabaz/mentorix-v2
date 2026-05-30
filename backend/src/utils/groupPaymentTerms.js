function paymentSchemeFromParts(billing_timing, payment_plan) {
  if (String(payment_plan || '').toLowerCase() === 'partial') return 'installment';
  if (String(billing_timing || '').toLowerCase() === 'prepaid') return 'full_prepaid';
  return 'postpaid_full';
}

function partsFromPaymentScheme(scheme) {
  const s = String(scheme || '').trim().toLowerCase();
  if (s === 'full_prepaid' || s === 'prepaid') {
    return { billing_timing: 'prepaid', payment_plan: 'full' };
  }
  if (s === 'installment' || s === 'partial') {
    return { billing_timing: 'postpaid', payment_plan: 'partial' };
  }
  return { billing_timing: 'postpaid', payment_plan: 'full' };
}

function parseDiscountPercent(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return Math.round(n * 100) / 100;
}

function computeFinalPackageFee(baseFee, discountPercent) {
  const base = Number(baseFee);
  if (!Number.isFinite(base) || base < 0) return null;
  const disc = parseDiscountPercent(discountPercent);
  if (disc == null || disc <= 0) return Math.round(base * 100) / 100;
  const final = base * (1 - disc / 100);
  return Math.round(final * 100) / 100;
}

function billingTypeLabel(bt) {
  if (bt === '12_lessons') return '12 dərs paketi';
  return '8 dərs paketi';
}

function paymentTimingLabel(billing_timing, payment_plan) {
  const scheme = paymentSchemeFromParts(billing_timing, payment_plan);
  if (scheme === 'full_prepaid') return 'Ödəniş paket başlamazdan əvvəl (tam)';
  if (scheme === 'installment') return 'Hissəli ödəniş (paket müddətində hissə-hissə)';
  return 'Ödəniş paket bitdikdən sonra (tam)';
}

function paymentTimingShort(billing_timing, payment_plan) {
  const scheme = paymentSchemeFromParts(billing_timing, payment_plan);
  if (scheme === 'full_prepaid') return 'əvvəlcədən';
  if (scheme === 'installment') return 'hissəli';
  return 'sonradan';
}

function buildPackagePreview(def) {
  if (!def || def.package_fee == null || !Number.isFinite(Number(def.package_fee))) return null;
  const package_fee = Number(def.package_fee);
  const discount_percent = parseDiscountPercent(def.discount_percent) ?? 0;
  const final_price = computeFinalPackageFee(package_fee, discount_percent);
  const billing_timing = def.billing_timing || 'postpaid';
  const payment_plan = def.payment_plan || 'full';
  return {
    billing_type: def.billing_type || '8_lessons',
    billing_type_label: billingTypeLabel(def.billing_type),
    package_fee,
    discount_percent: discount_percent > 0 ? discount_percent : null,
    final_price,
    billing_timing,
    payment_plan,
    payment_scheme: paymentSchemeFromParts(billing_timing, payment_plan),
    payment_timing_label: paymentTimingLabel(billing_timing, payment_plan),
    payment_timing_short: paymentTimingShort(billing_timing, payment_plan),
    lesson_weekdays: def.lesson_weekdays || [],
    lesson_times: def.lesson_times || {},
  };
}

module.exports = {
  paymentSchemeFromParts,
  partsFromPaymentScheme,
  parseDiscountPercent,
  computeFinalPackageFee,
  billingTypeLabel,
  paymentTimingLabel,
  paymentTimingShort,
  buildPackagePreview,
};
