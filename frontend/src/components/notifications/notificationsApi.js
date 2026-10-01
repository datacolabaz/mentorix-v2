import api from '../../lib/api'

export function fetchNotifications({ limit = 20, cursor, category, unread } = {}) {
  const params = { limit }
  if (cursor) params.cursor = cursor
  if (category) params.category = category
  if (unread) params.unread = 'true'
  return api.get('/notifications', { params })
}

export function fetchUnreadCount() {
  return api.get('/notifications/unread-count')
}

export function markNotificationRead(id) {
  return api.patch(`/notifications/${encodeURIComponent(id)}/read`)
}

export function markAllNotificationsRead(category) {
  return api.post('/notifications/read-all', category ? { category } : {})
}

/** Server marks it read and re-checks access to the target before returning `href`. */
export function openNotification(id) {
  return api.get(`/notifications/${encodeURIComponent(id)}/open`)
}

export function fetchNotificationPreferences() {
  return api.get('/notifications/preferences')
}

export function saveNotificationPreferences(preferences) {
  return api.put('/notifications/preferences', { preferences })
}
