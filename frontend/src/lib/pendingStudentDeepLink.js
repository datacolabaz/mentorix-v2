/** Survives onboarding / ProtectedRoute redirects after invite join. */
export const PENDING_STUDENT_DEEP_LINK_KEY = 'mx_pending_student_deep_link'

function readRaw() {
  try {
    const sessionVal = String(sessionStorage.getItem(PENDING_STUDENT_DEEP_LINK_KEY) || '').trim()
    if (sessionVal) return sessionVal
    return String(localStorage.getItem(PENDING_STUDENT_DEEP_LINK_KEY) || '').trim()
  } catch {
    return ''
  }
}

function writeRaw(raw) {
  try {
    if (!raw) {
      sessionStorage.removeItem(PENDING_STUDENT_DEEP_LINK_KEY)
      localStorage.removeItem(PENDING_STUDENT_DEEP_LINK_KEY)
      return
    }
    sessionStorage.setItem(PENDING_STUDENT_DEEP_LINK_KEY, raw)
    localStorage.setItem(PENDING_STUDENT_DEEP_LINK_KEY, raw)
  } catch {
    /* ignore */
  }
}

function normalizeLink(link) {
  if (!link || typeof link !== 'object') return null
  const kind = String(link.kind || '').trim().toLowerCase()
  if (kind === 'task') {
    const openId = String(link.openId || '').trim()
    const taskId = String(link.taskId || '').trim()
    if (!openId && !taskId) return null
    return { kind: 'task', openId: openId || null, taskId: taskId || null }
  }
  if (kind === 'exam') {
    const examId = String(link.examId || '').trim()
    if (!examId) return null
    return { kind: 'exam', examId }
  }
  return null
}

export function rememberPendingStudentDeepLink(link) {
  const normalized = normalizeLink(link)
  if (!normalized) return
  writeRaw(JSON.stringify(normalized))
}

export function peekPendingStudentDeepLink() {
  const raw = readRaw()
  if (!raw) return null
  try {
    return normalizeLink(JSON.parse(raw))
  } catch {
    return null
  }
}

export function consumePendingStudentDeepLink() {
  const current = peekPendingStudentDeepLink()
  writeRaw('')
  return current
}

/** Path used by postAuth / Dashboard when invite return was already consumed. */
export function pathForPendingStudentDeepLink(link = peekPendingStudentDeepLink()) {
  const normalized = normalizeLink(link)
  if (!normalized) return ''
  if (normalized.kind === 'task') {
    if (normalized.openId) {
      return `/student/assignments?open=${encodeURIComponent(normalized.openId)}`
    }
    return `/student/assignments?task=${encodeURIComponent(normalized.taskId)}`
  }
  if (normalized.kind === 'exam') {
    return `/student/exams?exam=${encodeURIComponent(normalized.examId)}`
  }
  return ''
}
