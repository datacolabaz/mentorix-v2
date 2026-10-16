/**
 * Server-derived access roles (backend: config/accessRoles.js). The client never decides permissions;
 * these helpers only choose what to show. Every action is checked again by the API.
 */
import api from './api'

export const ACCESS_ROLES = Object.freeze({
  SUPER_ADMIN: 'super_admin',
  ORGANIZATION_ADMIN: 'organization_admin',
  CORPORATE_MANAGER: 'corporate_manager',
  TEACHER: 'teacher',
  STUDENT: 'student',
  PARENT: 'parent',
})

export const ACCESS_ROLE_LABELS = Object.freeze({
  super_admin: 'Platforma admini',
  organization_admin: 'Təşkilat admini',
  corporate_manager: 'Korporativ menecer',
  teacher: 'Müəllim',
  student: 'Tələbə',
  parent: 'Valideyn',
})

export function accessRolesOf(user) {
  if (Array.isArray(user?.access_roles)) return user.access_roles
  // Older session payloads: fall back to the storage roles the server returned.
  const legacy = new Set([...(Array.isArray(user?.roles) ? user.roles : []), user?.role].filter(Boolean))
  const out = []
  if (legacy.has('admin')) out.push('super_admin')
  if (legacy.has('instructor')) out.push('teacher')
  if (legacy.has('student')) out.push('student')
  if (legacy.has('parent')) out.push('parent')
  return out
}

export function hasAccessRole(user, role) {
  return accessRolesOf(user).includes(role)
}

/** 'none' | 'pending' | 'approved' | 'rejected' | 'cancelled' */
export function teacherRequestStatus(user) {
  return user?.teacher_request?.status || 'none'
}

export function canReviewRoleRequests(user) {
  return user?.role === 'admin' || user?.can_review_role_requests === true
}

export const ROLE_REQUEST_STATUS_LABELS = Object.freeze({
  pending: 'Gözləyir',
  approved: 'Təsdiqləndi',
  rejected: 'Rədd edildi',
  cancelled: 'Ləğv edildi',
})

export async function requestTeacherRole({ note = '', organizationId = null } = {}) {
  return api.post('/role-requests', {
    role: 'teacher',
    note: note || undefined,
    organization_id: organizationId || undefined,
  })
}

export async function fetchMyRoleAccess() {
  return api.get('/role-requests/mine')
}
