/** Müəllim ödəniş tarixçəsi — status və mətnlər */

export const BILLING_PAYMENT_STATUS_AZ = {
  pending: 'Gözləyir',
  paid: 'Ödənilib',
  rejected: 'Rədd edilib',
  failed: 'Uğursuz',
  expired: 'Tamamlanmayıb',
}

export function billingPaymentStatusLabel(status) {
  const s = String(status || '').toLowerCase()
  return BILLING_PAYMENT_STATUS_AZ[s] || status || '—'
}

export function billingPaymentTitle(p) {
  if (p?.product_type === 'sms') return `+${p.sms_quantity || 0} SMS`
  const plan = String(p?.plan || '').toUpperCase()
  const interval = p?.billing_interval === 'yearly' ? ' (illik)' : p?.billing_interval === 'monthly' ? ' (aylıq)' : ''
  return `Paket: ${plan}${interval}`
}
