export function paymentSchemeFromForm(data) {
  if (data?.default_payment_plan === 'partial' || data?.payment_plan === 'partial') return 'installment'
  if ((data?.default_billing_timing || data?.billing_timing || 'postpaid') === 'prepaid') return 'full_prepaid'
  return 'postpaid_full'
}

export function applyPaymentScheme(prev, scheme) {
  if (scheme === 'full_prepaid') {
    return { ...prev, default_billing_timing: 'prepaid', default_payment_plan: 'full' }
  }
  if (scheme === 'installment') {
    return { ...prev, default_billing_timing: 'postpaid', default_payment_plan: 'partial' }
  }
  return { ...prev, default_billing_timing: 'postpaid', default_payment_plan: 'full' }
}

export function parseDiscountPercent(v) {
  if (v === undefined || v === null || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0 || n > 100) return null
  return Math.round(n * 100) / 100
}

export function computeFinalPackageFee(baseFee, discountPercent) {
  const base = Number(baseFee)
  if (!Number.isFinite(base) || base < 0) return null
  const disc = parseDiscountPercent(discountPercent)
  if (disc == null || disc <= 0) return Math.round(base * 100) / 100
  return Math.round(base * (1 - disc / 100) * 100) / 100
}

export function formatAzn(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  return `${v.toLocaleString('az-AZ', { maximumFractionDigits: 2 })} ₼`
}

export function paymentTimingLabel(scheme) {
  if (scheme === 'full_prepaid') return 'Ödəniş paket başlamazdan əvvəl (tam məbləğ)'
  if (scheme === 'installment') return 'Hissəli ödəniş (paket müddətində hissə-hissə)'
  return 'Ödəniş paket bitdikdən sonra (tam məbləğ)'
}

export function billingTypeLabel(bt) {
  if (bt === '12_lessons') return '12 dərs paketi'
  return '8 dərs paketi'
}
