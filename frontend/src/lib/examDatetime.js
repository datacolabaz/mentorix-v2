/**
 * <input type="datetime-local" /> dəyəri (YYYY-MM-DDTHH:mm) — istifadəçinin yerli saat qurşağı.
 * API üçün UTC instant (ISO string).
 */
export function localDatetimeInputToUtcIso(value) {
  if (!value || typeof value !== 'string') return value
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!m) return value
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const h = Number(m[4])
  const mi = Number(m[5])
  const dt = new Date(y, mo - 1, d, h, mi, 0, 0)
  if (Number.isNaN(dt.getTime())) return value
  return dt.toISOString()
}

/** Serverdən gələn ISO / tarix → datetime-local value (yerli divar saatı) */
export function utcInstantToDatetimeLocalValue(isoOrDate) {
  const dt = typeof isoOrDate === 'string' || typeof isoOrDate === 'number' ? new Date(isoOrDate) : isoOrDate
  if (!dt || Number.isNaN(dt.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}
