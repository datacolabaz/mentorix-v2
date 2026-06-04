/**
 * Tələbə tapşırıq səhifəsinə dərin link.
 */
export function studentTaskShareUrl(taskId) {
  if (!taskId) return ''
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const path = `/task/${encodeURIComponent(String(taskId))}`
  if (!origin) return path
  return `${origin}${path}`
}

export async function copyStudentTaskLink(taskId) {
  const url = studentTaskShareUrl(taskId)
  if (!url) throw new Error('Link yaradıla bilmədi')
  await navigator.clipboard.writeText(url)
  return url
}
