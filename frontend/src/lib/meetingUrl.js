/**
 * Client-side mirror of backend/src/lib/meetingUrl.js for instant form feedback.
 * The server re-validates every link; this file never decides access or safety on its own.
 */

export const PLATFORMS = ['google_meet', 'zoom', 'other']
export const MAX_URL_LENGTH = 500

const MEET_HOST = 'meet.google.com'
const MEET_CODE_RE = /^\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/
const ZOOM_HOST_RE = /^(?:[a-z0-9-]+\.)*zoom\.us$/
const ZOOM_PATH_RE = /^\/(?:j\/\d{9,11}|my\/[a-z0-9._-]{1,64})\/?$/i
const REDIRECT_PARAM_RE =
  /^(?:redirect|redirect_uri|redirect_url|return|returnto|return_to|returnurl|next|url|continue|dest|destination|goto|target|r|u)$/i
// eslint-disable-next-line no-control-regex
const FORBIDDEN_CHARS_RE = /[\s\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069\\<>"'`]/

export const MEETING_URL_ERRORS = {
  REQUIRED: 'Görüş linkini daxil edin.',
  TOO_LONG: 'Link çox uzundur.',
  INVALID: 'Link düzgün formatda deyil. Tam linki kopyalayıb yapışdırın (https:// ilə başlamalıdır).',
  HTTPS_ONLY: 'Yalnız təhlükəsiz https:// linkləri qəbul olunur.',
  CREDENTIALS: 'Linkdə istifadəçi adı və ya parol olmamalıdır.',
  MEET_FORMAT: 'Google Meet linki bu formatda olmalıdır: https://meet.google.com/abc-defg-hij',
  ZOOM_FORMAT: 'Zoom linki bu formatda olmalıdır: https://zoom.us/j/1234567890 (və ya https://ad.zoom.us/my/otaq)',
  PRIVATE_HOST: 'Daxili şəbəkə və ya IP ünvanlı linklər qəbul olunmur.',
  REDIRECT: 'Başqa sayta yönləndirən linklər qəbul olunmur. Platformanın birbaşa görüş linkini daxil edin.',
  PLATFORM: 'Platforma seçin: Google Meet, Zoom və ya Digər.',
  PLATFORM_MISMATCH_MEET: 'Bu Google Meet linkidir — platforma olaraq “Google Meet” seçin.',
  PLATFORM_MISMATCH_ZOOM: 'Bu Zoom linkidir — platforma olaraq “Zoom” seçin.',
}

const E = MEETING_URL_ERRORS
const fail = (error, code) => ({ ok: false, error, code })

export function normalizePlatform(raw) {
  const s = String(raw || '').trim().toLowerCase().replace(/-/g, '_')
  if (s === 'meet' || s === 'google' || s === 'googlemeet') return 'google_meet'
  return PLATFORMS.includes(s) ? s : null
}

function isIpOrLocalHost(host) {
  const h = String(host || '').toLowerCase()
  if (!h || h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(h)) return true
  if (h.startsWith('[') || h.includes(':')) return true
  return !h.includes('.')
}

function hasRedirectParam(u) {
  for (const [key, value] of u.searchParams) {
    if (REDIRECT_PARAM_RE.test(key) && /^(?:[a-z][a-z0-9+.-]*:|\/\/|%2f%2f)/i.test(String(value).trim())) return true
  }
  return false
}

/** Guess the platform from a pasted link (for auto-selecting the platform picker). */
export function detectPlatform(rawUrl) {
  try {
    const host = new URL(String(rawUrl || '').trim()).hostname.toLowerCase()
    if (host === MEET_HOST) return 'google_meet'
    if (ZOOM_HOST_RE.test(host)) return 'zoom'
    return 'other'
  } catch {
    return null
  }
}

export function validateMeetingUrl(rawUrl, platformRaw) {
  const platform = normalizePlatform(platformRaw)
  if (!platform) return fail(E.PLATFORM, 'PLATFORM')
  const raw = String(rawUrl ?? '').trim()
  if (!raw) return fail(E.REQUIRED, 'REQUIRED')
  if (raw.length > MAX_URL_LENGTH) return fail(E.TOO_LONG, 'TOO_LONG')
  if (FORBIDDEN_CHARS_RE.test(raw)) return fail(E.INVALID, 'INVALID')
  if (!/^https:\/\//i.test(raw)) {
    return /^[a-z][a-z0-9+.-]*:/i.test(raw) ? fail(E.HTTPS_ONLY, 'HTTPS_ONLY') : fail(E.INVALID, 'INVALID')
  }
  let u
  try {
    u = new URL(raw)
  } catch {
    return fail(E.INVALID, 'INVALID')
  }
  if (u.protocol !== 'https:') return fail(E.HTTPS_ONLY, 'HTTPS_ONLY')
  if (u.username || u.password) return fail(E.CREDENTIALS, 'CREDENTIALS')
  if (u.port && u.port !== '443') return fail(E.INVALID, 'INVALID')
  const host = u.hostname.toLowerCase()
  if (isIpOrLocalHost(host)) return fail(E.PRIVATE_HOST, 'PRIVATE_HOST')
  const isMeetHost = host === MEET_HOST
  const isZoomHost = ZOOM_HOST_RE.test(host)

  if (platform === 'google_meet') {
    if (!isMeetHost) return fail(isZoomHost ? E.PLATFORM_MISMATCH_ZOOM : E.MEET_FORMAT, 'MEET_FORMAT')
    const path = u.pathname.toLowerCase().replace(/\/$/, '')
    if (!MEET_CODE_RE.test(path)) return fail(E.MEET_FORMAT, 'MEET_FORMAT')
    const authuser = u.searchParams.get('authuser')
    const qs = authuser && /^\d{1,2}$/.test(authuser) ? `?authuser=${authuser}` : ''
    return { ok: true, platform, url: `https://${MEET_HOST}${path}${qs}` }
  }
  if (platform === 'zoom') {
    if (!isZoomHost) return fail(isMeetHost ? E.PLATFORM_MISMATCH_MEET : E.ZOOM_FORMAT, 'ZOOM_FORMAT')
    if (!ZOOM_PATH_RE.test(u.pathname)) return fail(E.ZOOM_FORMAT, 'ZOOM_FORMAT')
    const pwd = u.searchParams.get('pwd')
    const qs = pwd && /^[A-Za-z0-9._-]{1,128}$/.test(pwd) ? `?pwd=${pwd}` : ''
    return { ok: true, platform, url: `https://${host}${u.pathname.replace(/\/$/, '')}${qs}` }
  }
  if (isMeetHost) return fail(E.PLATFORM_MISMATCH_MEET, 'PLATFORM_MISMATCH')
  if (isZoomHost) return fail(E.PLATFORM_MISMATCH_ZOOM, 'PLATFORM_MISMATCH')
  if (hasRedirectParam(u)) return fail(E.REDIRECT, 'REDIRECT')
  return { ok: true, platform, url: u.toString() }
}

/** Lesson material link: any safe HTTPS page (not tied to a meeting platform). */
export function validateResourceLink(rawUrl) {
  const raw = String(rawUrl ?? '').trim()
  if (!raw) return fail(E.REQUIRED, 'REQUIRED')
  if (raw.length > MAX_URL_LENGTH) return fail(E.TOO_LONG, 'TOO_LONG')
  if (FORBIDDEN_CHARS_RE.test(raw)) return fail(E.INVALID, 'INVALID')
  if (!/^https:\/\//i.test(raw)) return fail(E.HTTPS_ONLY, 'HTTPS_ONLY')
  let u
  try {
    u = new URL(raw)
  } catch {
    return fail(E.INVALID, 'INVALID')
  }
  if (u.protocol !== 'https:') return fail(E.HTTPS_ONLY, 'HTTPS_ONLY')
  if (u.username || u.password) return fail(E.CREDENTIALS, 'CREDENTIALS')
  if (u.port && u.port !== '443') return fail(E.INVALID, 'INVALID')
  if (isIpOrLocalHost(u.hostname)) return fail(E.PRIVATE_HOST, 'PRIVATE_HOST')
  if (hasRedirectParam(u)) return fail(E.REDIRECT, 'REDIRECT')
  return { ok: true, url: u.toString() }
}

/** Only https links are ever rendered as clickable join links (defence in depth against javascript: etc). */
export function safeExternalHref(rawUrl) {
  try {
    const u = new URL(String(rawUrl || ''))
    return u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}
