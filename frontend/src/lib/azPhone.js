/** Azərbaycan mobil: +994 + 9 rəqəm (2+3+2+2 format). */

const AZ_MOBILE_PREFIXES = new Set(['10', '50', '51', '55', '60', '70', '77', '99'])

export function onlyDigits(s) {
  return String(s || '').replace(/\D/g, '')
}

export function nationalFromE164(phone) {
  const d = onlyDigits(phone)
  if (!d) return ''
  if (d.startsWith('994')) return d.slice(3, 12)
  if (d.length === 9) return d
  if (d.startsWith('0') && d.length === 10) return d.slice(1)
  return d.slice(0, 9)
}

export function isValidAzMobileNational(nineDigits) {
  const n = onlyDigits(nineDigits)
  if (n.length !== 9) return false
  return AZ_MOBILE_PREFIXES.has(n.slice(0, 2))
}

export function canonicalAzPhoneE164(phone) {
  const d = onlyDigits(phone)
  if (!d) return null
  let national = ''
  if (d.startsWith('994')) national = d.slice(3)
  else if (d.length === 9) national = d
  else if (d.startsWith('0') && d.length === 10) national = d.slice(1)
  else return null
  if (national.length !== 9 || !isValidAzMobileNational(national)) return null
  return `+994${national}`
}

export function formatAzNationalDisplay(nineDigits) {
  const n = onlyDigits(nineDigits).slice(0, 9)
  if (!n) return ''
  const a = n.slice(0, 2)
  const b = n.slice(2, 5)
  const c = n.slice(5, 7)
  const d = n.slice(7, 9)
  return [a, b, c, d].filter(Boolean).join(' ')
}
