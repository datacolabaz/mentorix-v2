import api from '../../lib/api'
import { adminActivityParams } from '../../lib/adminActivityAccess'

const withScope = (params = {}) => ({ params: { ...params, ...adminActivityParams() } })

const PLURAL = { material: 'materials', assignment: 'assignments', exam: 'exams' }
const plural = (type) => PLURAL[type] || 'materials'
const enc = encodeURIComponent

/** which: 'materials' | 'assignments' | 'exams'; ids — yalnız bu obyektlərin kartları (siyahı səhifələri üçün). */
export const fetchEngagementList = (which, ids = null) =>
  api.get(`/engagement/${which}`, withScope(ids?.length ? { ids: ids.join(',') } : {}))

/** Bir obyektin hesabatı. params: filter, status, group, q, from, to, page, page_size (page olmadan — hamısı). */
export const fetchEngagementDetail = (type, id, params = {}) =>
  api.get(`/engagement/${plural(type)}/${enc(id)}`, withScope(params))

export const fetchMaterialDetail = (id, filter = '') => fetchEngagementDetail('material', id, filter ? { filter } : {})
export const fetchAssignmentDetail = (id, filter = '') => fetchEngagementDetail('assignment', id, filter ? { filter } : {})
export const fetchExamDetail = (id, filter = '') => fetchEngagementDetail('exam', id, filter ? { filter } : {})

export const fetchStudentTimeline = (type, id, studentId) =>
  api.get(`/engagement/${plural(type)}/${enc(id)}/students/${enc(studentId)}/timeline`, withScope())

/** Göndərmədən əvvəl: alıcılar, son 6 saatda xatırladılanlar, mesaj önizləməsi. Heç nə yazmır. */
export const previewEngagementReminder = (type, id, studentIds = null) =>
  api.post(`/engagement/${plural(type)}/${enc(id)}/reminders/preview`, studentIds?.length ? { student_ids: studentIds } : {})

export async function sendEngagementReminder(type, id, studentIds = null) {
  return api.post(`/engagement/${plural(type)}/${enc(id)}/reminders`, studentIds?.length ? { student_ids: studentIds } : {})
}
