import api from '../../lib/api'
import { adminActivityParams } from '../../lib/adminActivityAccess'

const withScope = (params = {}) => ({ params: { ...params, ...adminActivityParams() } })

export const fetchEngagementList = (which) => api.get(`/engagement/${which}`, withScope())

export const fetchMaterialDetail = (id, filter = '') =>
  api.get(`/engagement/materials/${encodeURIComponent(id)}`, withScope(filter ? { filter } : {}))

export const fetchAssignmentDetail = (id, filter = '') =>
  api.get(`/engagement/assignments/${encodeURIComponent(id)}`, withScope(filter ? { filter } : {}))

export async function sendEngagementReminder(entity, id, studentIds = null) {
  const path = `/engagement/${entity === 'material' ? 'materials' : 'assignments'}/${encodeURIComponent(id)}/reminders`
  return api.post(path, studentIds?.length ? { student_ids: studentIds } : {})
}

/** Xatırlatma nəticəsi üçün tələbəyə yox, müəllimə göstərilən mətn. */
export function reminderResultText(r) {
  const sent = Number(r?.sent) || 0
  const skipped = Number(r?.skipped_recent) || 0
  const parts = []
  if (sent) parts.push(`${sent} tələbəyə xatırlatma göndərildi`)
  if (skipped) parts.push(`${skipped} tələbəyə son 6 saatda artıq göndərilib`)
  if (!parts.length) return 'Xatırlatma göndəriləcək tələbə yoxdur'
  return parts.join(' · ')
}
