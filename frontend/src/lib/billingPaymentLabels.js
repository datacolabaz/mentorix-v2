/** Bank kartı (köçürmə üçün) — 16 rəqəm */

export const BANK_CARD_DIGITS = 16

export function normalizeBankCardDigits(raw) {
  return String(raw || '')
    .replace(/\D/g, '')
    .slice(0, BANK_CARD_DIGITS)
}

export function formatBankCardDisplay(digits) {
  const s = normalizeBankCardDigits(digits)
  if (!s) return '—'
  if (s.length === BANK_CARD_DIGITS) {
    return s.match(/.{1,4}/g).join(' ')
  }
  return s.replace(/(.{4})/g, '$1 ').trim()
}

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
  if (p?.product_type === 'storage') return `+${p.storage_mb || 0} MB yaddaş`
  const plan = String(p?.plan || '').toUpperCase()
  const interval = p?.billing_interval === 'yearly' ? ' (illik)' : p?.billing_interval === 'monthly' ? ' (aylıq)' : ''
  return `Paket: ${plan}${interval}`
}
