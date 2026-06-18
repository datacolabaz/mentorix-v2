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

export function materialStoredFilename(url) {
  const s = String(url || '')
  const m = s.match(/\/api\/materials\/file\/([^/?#]+)$/i)
  return m ? decodeURIComponent(m[1]) : null
}

export function materialFileOpenUrl(url) {
  const fn = materialStoredFilename(url)
  if (!fn) return url || ''
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('mx_token') : ''
  const path = `/materials/file/${encodeURIComponent(fn)}`
  const withToken = token ? `${path}?token=${encodeURIComponent(token)}` : path
  return apiAbsoluteUrl(withToken)
}

export function materialFileKind(fileType, url) {
  const t = String(fileType || '').toLowerCase()
  if (t.includes('pdf')) return 'PDF'
  if (t.includes('word') || t.includes('msword')) return 'Word'
  if (t.includes('excel') || t.includes('spreadsheet') || t.includes('csv')) return 'Excel'
  if (t.includes('powerpoint') || t.includes('presentation')) return 'PowerPoint'
  if (t.startsWith('image/')) return 'Şəkil'
  const ext = String(url || '').split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return 'PDF'
  if (ext === 'doc' || ext === 'docx') return 'Word'
  if (ext === 'xls' || ext === 'xlsx' || ext === 'csv') return 'Excel'
  if (ext === 'ppt' || ext === 'pptx') return 'PowerPoint'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return 'Şəkil'
  return 'Fayl'
}

export function isMaterialPreviewable(fileType, url) {
  const t = String(fileType || '').toLowerCase()
  const s = String(url || '').toLowerCase()
  return t.startsWith('image/') || t.includes('pdf') || s.endsWith('.pdf') || /\.(png|jpe?g|gif|webp)$/.test(s)
}
