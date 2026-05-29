/** Tələbə imtahan səhifəsinə dərin link (login tələb olunur). */
export function studentExamShareUrl(examId) {
  if (!examId) return ''
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  if (!origin) return `/student/exams?exam=${encodeURIComponent(String(examId))}`
  return `${origin}/student/exams?exam=${encodeURIComponent(String(examId))}`
}

export async function copyStudentExamLink(examId) {
  const url = studentExamShareUrl(examId)
  if (!url) throw new Error('Link yaradıla bilmədi')
  await navigator.clipboard.writeText(url)
  return url
}
