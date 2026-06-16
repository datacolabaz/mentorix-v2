import api from './api'

export async function fetchChatCapabilities() {
  const d = await api.get('/chat/capabilities')
  return d?.capabilities || null
}

export async function fetchChatGroups() {
  const d = await api.get('/chat/groups')
  return Array.isArray(d?.groups) ? d.groups : []
}

export async function openChatRoom(payload) {
  const d = await api.post('/chat/rooms/open', payload)
  return d?.room || null
}

export async function fetchChatMessages(roomId, { before, limit } = {}) {
  const qs = new URLSearchParams()
  if (before) qs.set('before', before)
  if (limit) qs.set('limit', String(limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const d = await api.get(`/chat/rooms/${roomId}/messages${suffix}`)
  return Array.isArray(d?.messages) ? d.messages : []
}

export async function sendChatMessage(roomId, bodyOrPayload) {
  const payload =
    typeof bodyOrPayload === 'string' ? { body: bodyOrPayload } : bodyOrPayload || {}
  const d = await api.post(`/chat/rooms/${roomId}/messages`, payload)
  if (d?.message && typeof d.message === 'object') return d.message
  if (d?.id) return d
  return null
}

export async function uploadChatAttachment(roomId, file) {
  const fd = new FormData()
  fd.append('file', file)
  const d = await api.post(`/chat/rooms/${roomId}/attachments`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return d || null
}

export const CHAT_MAX_FILE_BYTES = 5 * 1024 * 1024
