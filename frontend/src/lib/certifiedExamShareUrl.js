import { SITE_ORIGIN } from './pageSeo'

export function buildCertifiedExamSharePath(categorySlug, examSlug) {
  const cat = String(categorySlug || '').trim()
  const exam = String(examSlug || '').trim()
  if (!cat || !exam) return null
  return `/sertifikatli-imtahanlar/${encodeURIComponent(cat)}/${encodeURIComponent(exam)}`
}

export function buildCertifiedExamShareUrl(categorySlug, examSlug) {
  const path = buildCertifiedExamSharePath(categorySlug, examSlug)
  return path ? `${SITE_ORIGIN}${path}` : null
}

export async function copyCertifiedExamShareUrl(categorySlug, examSlug) {
  const url = buildCertifiedExamShareUrl(categorySlug, examSlug)
  if (!url) throw new Error('share url missing')
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url)
    return url
  }
  const ta = document.createElement('textarea')
  ta.value = url
  ta.setAttribute('readonly', '')
  ta.style.position = 'absolute'
  ta.style.left = '-9999px'
  document.body.appendChild(ta)
  ta.select()
  document.execCommand('copy')
  document.body.removeChild(ta)
  return url
}
