/**
 * Admin müəllimin tələbə fəaliyyətinə baxanda: hədəf müəllim + səbəb hər engagement sorğusuna əlavə olunur
 * (backend səbəbsiz 400 qaytarır və hər baxışı admin_access_audit-ə yazır). Admin baxışı yalnız oxumaqdır.
 * Səbəb yalnız yaddaşda saxlanılır: səhifə yenilənəndə və ya admin baxışdan çıxanda yenidən soruşulur.
 */

export const ADMIN_REASON_MIN_LENGTH = 5
export const ADMIN_REASON_MAX_LENGTH = 500

let scope = null

export function normalizeAdminReason(raw) {
  return String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, ADMIN_REASON_MAX_LENGTH)
}

export function isValidAdminReason(raw) {
  return normalizeAdminReason(raw).length >= ADMIN_REASON_MIN_LENGTH
}

export function setAdminActivityScope({ instructorId, reason }) {
  const why = normalizeAdminReason(reason)
  if (!instructorId || why.length < ADMIN_REASON_MIN_LENGTH) {
    scope = null
    return false
  }
  scope = { instructorId: String(instructorId), reason: why }
  return true
}

export function clearAdminActivityScope() {
  scope = null
}

export function getAdminActivityScope() {
  return scope
}

export function isAdminActivityMode() {
  return scope != null
}

/** Engagement sorğularına əlavə olunan query parametrləri (müəllim üçün boş). */
export function adminActivityParams() {
  return scope ? { instructor_id: scope.instructorId, reason: scope.reason } : {}
}

export function engagementBasePath() {
  return scope ? `/admin/instructors/${encodeURIComponent(scope.instructorId)}/activity` : '/instructor/engagement'
}

const INSTRUCTOR_DETAIL_PATHS = {
  exam: (id) => `/instructor/exams/${id}/participants`,
  assignment: (id) => `/instructor/assignments/${id}/activity`,
  material: (id) => `/instructor/materials/${id}/activity`,
}

/** Bir obyektin aktivlik hesabatı: müəllim üçün obyektin öz marşrutu, admin üçün oxuma rejimindəki marşrut. */
export function activityDetailPath(type, id, search = '') {
  const safeId = encodeURIComponent(String(id ?? ''))
  const base = scope
    ? `${engagementBasePath()}/${type}/${safeId}`
    : (INSTRUCTOR_DETAIL_PATHS[type] || INSTRUCTOR_DETAIL_PATHS.material)(safeId)
  const qs = typeof search === 'string' ? search.replace(/^\?/, '') : new URLSearchParams(search || {}).toString()
  return qs ? `${base}?${qs}` : base
}

export function isAdminReasonError(err) {
  return err?.code === 'ADMIN_REASON_REQUIRED' || err?.code === 'ADMIN_TARGET_REQUIRED'
}
