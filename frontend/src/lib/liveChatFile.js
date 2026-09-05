export const LIVE_CHAT_FILE_MAX_BYTES = 5 * 1024 * 1024
export const LIVE_CHAT_FILE_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf'

export function isAllowedLiveChatAttachmentUrl(url) {
  return /^\/api\/live\/chat-attachments\/[A-Za-z0-9._-]+$/.test(String(url || '').trim())
}

export function sanitizeLiveChatFile(raw) {
  if (!raw || typeof raw !== 'object') return null
  const url = String(raw.url || '').trim()
  if (!isAllowedLiveChatAttachmentUrl(url)) return null
  return {
    url,
    name: String(raw.name || 'file').slice(0, 180),
    type: String(raw.type || '').slice(0, 80),
    size: Number(raw.size) || 0,
  }
}

export function liveChatFileOpenUrl(file, guestAuth) {
  const safe = sanitizeLiveChatFile(file)
  if (!safe) return ''
  const fn = safe.url.split('/').pop()
  const params = new URLSearchParams()
  if (guestAuth?.inviteToken && guestAuth?.participantId) {
    params.set('invite', guestAuth.inviteToken)
    params.set('participantId', guestAuth.participantId)
  } else if (typeof localStorage !== 'undefined') {
    const token = localStorage.getItem('mx_token')
    if (token) params.set('token', token)
  }
  const q = params.toString()
  const path = `/api/live/chat-attachments/${encodeURIComponent(fn)}${q ? `?${q}` : ''}`
  if (typeof window === 'undefined') return path
  return `${window.location.origin}${path}`
}

export function isLiveChatImage(file) {
  return /^image\/(jpeg|png|webp)$/i.test(String(file?.type || ''))
}
