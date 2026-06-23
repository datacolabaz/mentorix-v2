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

export function chatAttachmentFilename(url) {
  const s = String(url || '')
  const m = s.match(/\/api\/(?:chat\/attachments|uploads\/chat)\/([^/?#]+)$/i)
  return m ? decodeURIComponent(m[1]) : null
}

export function chatAttachmentOpenUrl(url) {
  const fn = chatAttachmentFilename(url)
  if (!fn) return url || ''
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('mx_token') : ''
  const path = `/chat/attachments/${encodeURIComponent(fn)}`
  const withToken = token ? `${path}?token=${encodeURIComponent(token)}` : path
  return apiAbsoluteUrl(withToken)
}
