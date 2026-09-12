import api from './api'
import { userNeedsOnboarding } from '../constants/personas'

/**
 * Invite pages (task/exam/material/join): Google/email often returns a token with
 * role=null until onboarding is incomplete. Student APIs require role=student, so
 * finish a light student persona here before join/access-from-link.
 *
 * Also covers role=student with onboarding_completed=false — ProtectedRoute would
 * otherwise bounce /student/assignments to /onboarding → home and drop the open deep link.
 */
async function finishStudentPersona(setSession, subjectHint) {
  const subject = String(subjectHint || '').trim() || 'Tapşırıq'
  const done = await api.post('/auth/onboarding/persona', {
    persona: 'student',
    profile: { education_level: 'other', subject_interest: subject.slice(0, 120) },
  })
  if (!done?.token || !done?.user) return null
  setSession(done.token, { ...done.user, needs_phone_verification: false })
  return done.user
}

export async function ensureStudentInviteSession(
  authResult,
  { setSession, toast, subjectHint = 'Tapşırıq' } = {},
) {
  if (authResult?.needs_phone_link) {
    toast?.('Bu Google hesabı başqa telefon hesabına bağlıdır.', 'error')
    return null
  }
  if (!authResult?.token || !authResult?.user) {
    toast?.(authResult?.message || 'Giriş tamamlanmadı', 'error')
    return null
  }
  if (authResult.user.role && authResult.user.role !== 'student') {
    toast?.('Bu hesab tələbə deyil', 'error')
    return null
  }

  setSession(authResult.token, { ...authResult.user, needs_phone_verification: false })
  let authUser = authResult.user

  if (authUser.role !== 'student' || userNeedsOnboarding(authUser)) {
    const doneUser = await finishStudentPersona(setSession, subjectHint)
    if (!doneUser) {
      toast?.(authResult?.message || 'Tələbə sessiyası tamamlanmadı', 'error')
      return null
    }
    authUser = doneUser
  }

  return authUser
}

/** Already signed in on an invite page with role still null (post-login return). */
export async function completeStudentInviteOnboarding(
  user,
  { setSession, subjectHint = 'Tapşırıq' } = {},
) {
  if (!user?.id) return null
  if (user.role && user.role !== 'student') return null
  if (user.role === 'student' && !userNeedsOnboarding(user)) return user

  return finishStudentPersona(setSession, subjectHint)
}
