import { normalizeApiBaseUrl } from './apiBase'

function chatApiOrigin() {
  const base = normalizeApiBaseUrl(import.meta.env.VITE_API_URL)
  if (base.startsWith('http')) return base.replace(/\/+$/, '')
  if (typeof window !== 'undefined') return `${window.location.origin}${base}`.replace(/\/+$/, '')
  return base
}

export function buildChatStreamUrl(roomId) {
  const token = localStorage.getItem('mx_token')
  if (!roomId || !token) return null
  const origin = chatApiOrigin()
  const qs = new URLSearchParams({ access_token: token })
  return `${origin}/chat/rooms/${encodeURIComponent(roomId)}/stream?${qs.toString()}`
}

/**
 * Subscribe to live chat messages via Server-Sent Events.
 * @returns {() => void} unsubscribe
 */
export function subscribeChatRoom(roomId, { onMessage, onConnected, onError } = {}) {
  const url = buildChatStreamUrl(roomId)
  if (!url) return () => {}

  const es = new EventSource(url)

  es.onmessage = (ev) => {
    try {
      const data = JSON.parse(ev.data)
      if (data?.type === 'connected') {
        onConnected?.(data)
        return
      }
      if (data?.type === 'message' && data.message) {
        onMessage?.(data.message)
      }
    } catch {
      /* ignore malformed frames */
    }
  }

  es.onerror = () => {
    onError?.()
  }

  return () => {
    es.close()
  }
}
