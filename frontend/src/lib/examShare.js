/**
 * Tələbə imtahan səhifəsinə dərin link (login tələb olunur).
 * Link açılanda müəllimə avtomatik təsdiq sorğusu gedir (Sorğular bölməsi).
 */
export function studentExamShareUrl(examId) {
  if (!examId) return ''
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const path = `/exam/${encodeURIComponent(String(examId))}`
  if (!origin) return path
  return `${origin}${path}`
}

export async function copyStudentExamLink(examId) {
  const url = studentExamShareUrl(examId)
  if (!url) throw new Error('Link yaradıla bilmədi')
  await navigator.clipboard.writeText(url)
  return url
}
