const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^\+?[\d\s()-]+$/

/** Backend /auth/login ilə eyni bölgü: «@» olan dəyər email, qalanı ən azı 9 rəqəmli telefon. */
export function isValidAdminIdentifier(value) {
  const s = String(value || '').trim()
  if (!s) return false
  if (s.includes('@')) return EMAIL_RE.test(s)
  return PHONE_RE.test(s) && s.replace(/\D/g, '').length >= 9
}
