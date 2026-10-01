const ENGLISH_STYLE = new Set(['en', 'tr', 'de'])
const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function toDate(value) {
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function zonedParts(d, timeZone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d)
  const get = (t) => parts.find((p) => p.type === t)?.value
  return {
    day: Number(get('day')),
    month: Number(get('month')),
    year: Number(get('year')),
    hour: get('hour'),
    minute: get('minute'),
  }
}

/**
 * Locale-aware date + time in Asia/Baku (month names never come from Intl).
 *   az (and ru): `29.09.2026, 21:34`
 *   en (tr/de use en resources): `Sep 29, 2026, 21:34`
 * API timestamps must carry a zone (ISO with `Z`), otherwise they are read as browser-local.
 */
export function formatDateTime(value, lang, opts = {}) {
  if (value == null || value === '') return ''
  const d = toDate(value)
  if (!d) return ''
  const p = zonedParts(d, opts.timeZone || 'Asia/Baku')
  if (!p.day || !p.month || !p.year) return ''
  const l = String(lang || '').toLowerCase().split(/[-_]/)[0]
  if (ENGLISH_STYLE.has(l)) {
    return `${EN_MONTHS[p.month - 1]} ${p.day}, ${p.year}, ${p.hour}:${p.minute}`
  }
  return `${String(p.day).padStart(2, '0')}.${String(p.month).padStart(2, '0')}.${p.year}, ${p.hour}:${p.minute}`
}

/** Machine-readable value for `<time dateTime>`. */
export function isoDateTime(value) {
  if (value == null || value === '') return ''
  const d = toDate(value)
  return d ? d.toISOString() : ''
}
