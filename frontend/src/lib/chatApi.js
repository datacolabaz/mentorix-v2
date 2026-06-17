import api from './api'
import { withEnrollmentQuery } from './studentGroupQuery'

export async function fetchChatCapabilities() {
  const d = await api.get('/chat/capabilities')
  return d?.capabilities || null
}

export async function fetchChatGroups() {
  const d = await api.get('/chat/groups')
  return Array.isArray(d?.groups) ? d.groups : []
}

export async function fetchChatDirects() {
  const d = await api.get('/chat/direct')
  return Array.isArray(d?.conversations) ? d.conversations : []
}

function mapInstructorTasksToAssignmentChats(tasks) {
  return (tasks || []).map((t) => ({
    assignment_id: t.id,
    assignment_title: t.title || 'Tapşırıq',
    room_id: null,
    member_count: Number(t.assigned_count || 0) + 1,
    online_count: 0,
  }))
}

function mapStudentTasksToAssignmentChats(tasks) {
  return (tasks || []).map((t) => ({
    assignment_id: t.assignment_id || t.id,
    assignment_title: t.title || 'Tapşırıq',
    room_id: null,
    member_count: null,
    online_count: 0,
  }))
}

export async function fetchChatAssignments({ role, enrollmentId } = {}) {
  const paths = ['/chat/assignment-chats', '/chat/assignments']
  for (const path of paths) {
    try {
      const d = await api.get(path)
      if (Array.isArray(d?.assignments)) return d.assignments
    } catch (e) {
      const status = e?.status || e?.response?.status
      if (status !== 404 && status !== 503) throw e
    }
  }

  if (role === 'instructor') {
    const d = await api.get('/tasks')
    return mapInstructorTasksToAssignmentChats(d?.tasks)
  }

  if (role === 'student') {
    const d = await api.get(withEnrollmentQuery('/tasks/my', enrollmentId))
    const rows = Array.isArray(d?.tasks) ? d.tasks : Array.isArray(d?.assignments) ? d.assignments : []
    return mapStudentTasksToAssignmentChats(rows)
  }

  return []
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
