import i18n from '../i18n'

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
  if (scheme === 'full_prepaid') return i18n.t('teachingGroups.packageFields.timingPrepaid')
  if (scheme === 'installment') return i18n.t('teachingGroups.packageFields.timingInstallment')
  return i18n.t('teachingGroups.packageFields.timingPostpaid')
}

export function billingTypeLabel(bt) {
  if (bt === '12_lessons') return i18n.t('teachingGroups.packageFields.pack12')
  return i18n.t('teachingGroups.packageFields.pack8')
}
