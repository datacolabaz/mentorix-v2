import api from './api'

export async function fetchChatCapabilities() {
  const d = await api.get('/chat/capabilities')
  return d?.capabilities || null
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

export async function sendChatMessage(roomId, body) {
  const d = await api.post(`/chat/rooms/${roomId}/messages`, { body })
  return d?.message || null
}
