export const STUDENT_ACTIVE_ENROLLMENT_KEY = 'student_active_enrollment_id'

export function withEnrollmentQuery(path, enrollmentId) {
  if (!enrollmentId) return path
  const sep = path.includes('?') ? '&' : '?'
  return `${path}${sep}enrollment_id=${encodeURIComponent(enrollmentId)}`
}

export function readStoredEnrollmentId() {
  try {
    return localStorage.getItem(STUDENT_ACTIVE_ENROLLMENT_KEY) || ''
  } catch {
    return ''
  }
}

export function storeEnrollmentId(id) {
  try {
    if (id) localStorage.setItem(STUDENT_ACTIVE_ENROLLMENT_KEY, id)
    else localStorage.removeItem(STUDENT_ACTIVE_ENROLLMENT_KEY)
  } catch {
    /* ignore */
  }
}
