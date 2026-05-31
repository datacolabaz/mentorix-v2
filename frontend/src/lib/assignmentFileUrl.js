import api from './api'
import { resolveApiAssetUrl } from './apiAssetUrl'

/** Diskdə saxlanan fayl adı: uuid.ext */
export function assignmentStoredFilename(url) {
  const s = String(url || '')
  let m = s.match(/\/api\/uploads\/assignments\/([^/?#]+)$/i)
  if (m) return decodeURIComponent(m[1])
  m = s.match(/uploads\/assignments\/([^/?#]+)$/i)
  return m ? decodeURIComponent(m[1]) : null
}

function apiAbsoluteUrl(pathnameWithLeadingSlash) {
  const p = String(pathnameWithLeadingSlash || '')
  if (!p) return ''
  const base = String(api?.defaults?.baseURL || '/api').replace(/\/+$/, '')
  if (base.startsWith('http')) return `${base}${p}`
  if (typeof window === 'undefined') return `${base}${p}`
  const pref = base.startsWith('/') ? base : `/${base}`
  return `${window.location.origin}${pref}${p}`
}

/** Yeni pəncərədə açmaq/yükləmək — JWT ?token= (Vercel-də /api/uploads 404 olmur) */
export function assignmentFileOpenUrl(url) {
  const fn = assignmentStoredFilename(url)
  if (!fn) return resolveApiAssetUrl(url)
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('mx_token') : ''
  const path = `/tasks/assignment-file/${encodeURIComponent(fn)}`
  const withToken = token ? `${path}?token=${encodeURIComponent(token)}` : path
  return apiAbsoluteUrl(withToken)
}

export function assignmentFileLabel(url) {
  const fn = assignmentStoredFilename(url)
  if (!fn) return String(url || 'Fayl')
  const ext = fn.split('.').pop()?.toLowerCase() || ''
  const kind =
    ext === 'pdf'
      ? 'PDF'
      : ext === 'doc' || ext === 'docx'
        ? 'Word'
        : ext === 'png' || ext === 'jpg' || ext === 'jpeg'
          ? 'Şəkil'
          : ext.toUpperCase()
  return `${kind} — ${fn}`
}

export function isAssignmentPreviewable(url) {
  const s = String(url || '').toLowerCase()
  return (
    s.endsWith('.pdf') ||
    s.endsWith('.png') ||
    s.endsWith('.jpg') ||
    s.endsWith('.jpeg') ||
    s.endsWith('.webp') ||
    s.endsWith('.gif')
  )
}
