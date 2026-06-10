import api from './api'

const SESSION_KEY = 'mx_analytics_session'
const UTM_KEY = 'mx_utm_attribution'

const PUBLIC_TRACK_PREFIXES = ['/login', '/search', '/verify-email', '/reset-password', '/join']

export function getClientDeviceType() {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent || ''
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)) return 'tablet'
  if (/Mobi|Android|iPhone|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return 'mobile'
  if (ua) return 'desktop'
  return 'unknown'
}

function getSessionKey() {
  try {
    let key = localStorage.getItem(SESSION_KEY)
    if (!key) {
      key =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `mx-${Date.now()}-${Math.random().toString(36).slice(2)}`
      localStorage.setItem(SESSION_KEY, key)
    }
    return key
  } catch {
    return null
  }
}

function persistUtmFromUrl() {
  if (typeof window === 'undefined') return
  try {
    const params = new URLSearchParams(window.location.search)
    const utm_source = params.get('utm_source')
    const utm_medium = params.get('utm_medium')
    if (utm_source || utm_medium) {
      sessionStorage.setItem(
        UTM_KEY,
        JSON.stringify({
          utm_source: utm_source || '',
          utm_medium: utm_medium || '',
          referrer_url: document.referrer || '',
          captured_at: Date.now(),
        }),
      )
    } else if (document.referrer && !sessionStorage.getItem(UTM_KEY)) {
      sessionStorage.setItem(
        UTM_KEY,
        JSON.stringify({ utm_source: '', utm_medium: '', referrer_url: document.referrer, captured_at: Date.now() }),
      )
    }
  } catch {
    /* ignore */
  }
}

export function getAttributionPayload() {
  persistUtmFromUrl()
  let utm = {}
  try {
    const raw = sessionStorage.getItem(UTM_KEY)
    if (raw) utm = JSON.parse(raw)
  } catch {
    utm = {}
  }
  return {
    device_type: getClientDeviceType(),
    session_key: getSessionKey(),
    utm_source: utm.utm_source || null,
    utm_medium: utm.utm_medium || null,
    referrer_url: utm.referrer_url || (typeof document !== 'undefined' ? document.referrer : null),
  }
}

function sendEvent(payload) {
  api.post('/public/analytics/event', { ...getAttributionPayload(), ...payload }).catch(() => {})
}

const LANDING_EVENT_MAP = {
  mx_public_landing_view: 'landing_view',
}

export function trackEvent(name, props = {}) {
  const eventType = LANDING_EVENT_MAP[name] || props.event_type
  if (!eventType) return
  sendEvent({
    event_type: eventType,
    path: props.path || (typeof window !== 'undefined' ? window.location.pathname : null),
    role: props.role,
  })
}

export function trackPageView(pathname) {
  const path = pathname || (typeof window !== 'undefined' ? window.location.pathname : '/')
  if (!PUBLIC_TRACK_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) return
  const eventType = path === '/login' || path.startsWith('/login') ? 'landing_view' : 'page_view'
  sendEvent({ event_type: eventType, path })
}

export function trackRegisterClick() {
  sendEvent({ event_type: 'register_click', path: '/login' })
}

export function trackPricingView() {
  sendEvent({ event_type: 'pricing_view', path: '/login#demo' })
}

export function trackLogout() {
  if (!localStorage.getItem('mx_token')) return
  sendEvent({
    event_type: 'logout',
    path: typeof window !== 'undefined' ? window.location.pathname : null,
  })
}

/** Admin paneldə "online" sayı üçün — hər 60 saniyə */
export function trackPresencePing(role) {
  sendEvent({
    event_type: 'presence_ping',
    path: typeof window !== 'undefined' ? window.location.pathname : null,
    role: role || null,
  })
}
