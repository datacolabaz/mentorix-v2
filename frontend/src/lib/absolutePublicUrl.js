/** Relative `/live/join/...` paths become origin-absolute so WhatsApp/QR open the site, not a file. */
export function absolutePublicUrl(raw, origin = typeof window !== 'undefined' ? window.location.origin : '') {
  const value = String(raw || '').trim()
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  const base = String(origin || '').replace(/\/+$/, '')
  if (!base) return value.startsWith('/') ? value : `/${value}`
  const path = value.startsWith('/') ? value : `/${value}`
  return `${base}${path}`
}

/** Prefer path + current origin so a relative API `join_url` is never copied/QR'd. */
export function liveGuestJoinUrl(invite, origin = typeof window !== 'undefined' ? window.location.origin : '') {
  const token = String(invite?.token || '').trim()
  const path = String(invite?.join_path || '').trim() || (token ? `/live/join/${token}` : '')
  if (path) return absolutePublicUrl(path, origin)
  return absolutePublicUrl(invite?.join_url, origin)
}
