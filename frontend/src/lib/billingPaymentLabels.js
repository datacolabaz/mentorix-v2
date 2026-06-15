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
  if (p?.product_type === 'storage') {
    const mb = Math.round(Number(p.storage_mb) || 0)
    if (mb >= 1024 && mb % 1024 === 0) return `+${mb / 1024} GB Sənəd Yaddaşı`
    return `+${mb} MB Sənəd Yaddaşı`
  }
  const plan = String(p?.plan || '').toUpperCase()
  const interval = p?.billing_interval === 'yearly' ? ' (illik)' : p?.billing_interval === 'monthly' ? ' (aylıq)' : ''
  return `Paket: ${plan}${interval}`
}

/** Köçürmə qəbzini qəbul edən WhatsApp */
export const BILLING_RECEIPT_WHATSAPP_MSISDN = '994553775770'

export function billingReceiptWhatsAppUrl({ amountAzn, product } = {}) {
  const productAz =
    product === 'sms' ? 'SMS paketi' : product === 'storage' ? 'yaddaş paketi' : 'paket'
  let text = 'Salam, Mentorix paket ödənişi ilə bağlı qəbzi göndərirəm.'
  if (amountAzn != null && Number.isFinite(Number(amountAzn))) {
    text = `Salam, Mentorix ${productAz} ödənişi ilə bağlı qəbzi göndərirəm. Məbləğ: ${amountAzn} AZN`
  }
  return `https://wa.me/${BILLING_RECEIPT_WHATSAPP_MSISDN}?text=${encodeURIComponent(text)}`
}

export function openBillingReceiptWhatsApp(opts) {
  window.open(billingReceiptWhatsAppUrl(opts), '_blank', 'noopener,noreferrer')
}
