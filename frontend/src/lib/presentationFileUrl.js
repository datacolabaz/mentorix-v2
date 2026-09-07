import api from './api'

function apiAbsoluteUrl(pathnameWithLeadingSlash) {
  const p = String(pathnameWithLeadingSlash || '')
  if (!p) return ''
  const base = String(api?.defaults?.baseURL || '/api').replace(/\/+$/, '')
  if (base.startsWith('http')) return `${base}${p}`
  if (typeof window === 'undefined') return `${base}${p}`
  const pref = base.startsWith('/') ? base : `/${base}`
  return `${window.location.origin}${pref}${p}`
}

export function presentationStoredFilename(url) {
  const s = String(url || '')
  const m = s.match(/\/api\/presentations\/file\/([^/?#]+)$/i)
  return m ? decodeURIComponent(m[1]) : null
}

export function presentationFileOpenUrl(url) {
  const fn = presentationStoredFilename(url)
  if (!fn) return url || ''
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('mx_token') : ''
  const path = `/presentations/file/${encodeURIComponent(fn)}`
  const params = new URLSearchParams()
  if (token) params.set('token', token)
  const qs = params.toString()
  return apiAbsoluteUrl(qs ? `${path}?${qs}` : path)
}
