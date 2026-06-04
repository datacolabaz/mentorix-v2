/** API base URL — api.js ilə eyni məntiq (şəkil və fayl URL-ləri üçün) */

export function normalizeApiBaseUrl(raw) {
  const v = raw != null ? String(raw).trim().replace(/\/+$/, '') : ''
  if (!v) return '/api'
  const withProto = v.includes('://') || v.startsWith('/') ? v : `https://${v}`
  if (withProto.endsWith('/api')) return withProto
  return `${withProto}/api`
}

/** /api/uploads/... → brauzer üçün tam URL */
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
  const apiBase = normalizeApiBaseUrl(import.meta.env.VITE_API_URL)

  if (apiBase.startsWith('http')) {
    const origin = apiBase.replace(/\/api\/?$/i, '')
    return `${origin}${p}`
  }

  if (typeof window !== 'undefined') {
    return `${window.location.origin}${p}`
  }
  return p
}
