/** Serverdən gələn /api/uploads/... üçün tam URL */
export function resolveApiAssetUrl(rel) {
  if (!rel || typeof rel !== 'string') return ''
  let r = String(rel).trim()
  if (r.startsWith('//') && typeof window !== 'undefined') {
    r = `${window.location.protocol}${r}`
  }
  if (r.startsWith('http')) {
    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && r.startsWith('http:')) {
      r = `https:${r.slice('http:'.length)}`
    }
    return r
  }
  const p = r.startsWith('/') ? r : `/${r}`
  const rawBase = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '')
  let origin = ''
  if (rawBase) {
    if (rawBase.startsWith('/')) {
      const stripped = rawBase.replace(/\/api\/?$/, '')
      origin = (typeof window !== 'undefined' ? window.location.origin : '') + stripped
    } else {
      origin = rawBase.replace(/\/api\/?$/, '') || (typeof window !== 'undefined' ? window.location.origin : '')
    }
  } else if (typeof window !== 'undefined') {
    origin = window.location.origin
  }
  if (!origin && typeof window !== 'undefined') origin = window.location.origin
  return origin ? `${origin}${p}` : p
}
