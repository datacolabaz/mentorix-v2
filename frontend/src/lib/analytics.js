import api from './api'

const SESSION_KEY = 'mx_analytics_session'

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

function sendEvent(payload) {
  api.post('/public/analytics/event', payload).catch(() => {})
}

const LANDING_EVENT_MAP = {
  mx_public_landing_view: 'landing_view',
}

/** Marketinq / landing hadisələri */
export function trackEvent(name, props = {}) {
  const eventType = LANDING_EVENT_MAP[name] || props.event_type
  if (!eventType) return
  sendEvent({
    event_type: eventType,
    device_type: getClientDeviceType(),
    path: props.path || (typeof window !== 'undefined' ? window.location.pathname : null),
    session_key: getSessionKey(),
    role: props.role,
  })
}

/** Çıxış — token silinməzdən əvvəl çağırın */
export function trackLogout() {
  if (!localStorage.getItem('mx_token')) return
  sendEvent({
    event_type: 'logout',
    device_type: getClientDeviceType(),
    path: typeof window !== 'undefined' ? window.location.pathname : null,
    session_key: getSessionKey(),
  })
}
