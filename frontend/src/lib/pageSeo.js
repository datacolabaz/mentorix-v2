const SITE_ORIGIN = 'https://mentorix.io'

const DEFAULT_TITLE = 'Mentorix — müəllimlər üçün tələbə, ödəniş və davamiyyət paneli'
const DEFAULT_DESCRIPTION =
  'Mentorix: müəllim və təlimçilər üçün tələbə analizləri, avtomatik ödəniş bildirişləri, davamiyyət, imtahan və ictimai repetitor axtarışı. Azərbaycanda repetitor Bakı.'

function upsertMeta(name, content) {
  if (!content) return
  let el = document.querySelector(`meta[name="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('name', name)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function upsertOg(property, content) {
  if (!content) return
  let el = document.querySelector(`meta[property="${property}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('property', property)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

/**
 * SPA səhifələri üçün title, description, canonical (Google indeksi).
 */
export function setPageSeo({ title, description, canonicalPath, keywords }) {
  if (typeof document === 'undefined') return

  const nextTitle = title || DEFAULT_TITLE
  const nextDescription = description || DEFAULT_DESCRIPTION

  document.title = nextTitle

  upsertMeta('description', nextDescription)
  if (keywords) upsertMeta('keywords', keywords)

  const path = canonicalPath != null ? String(canonicalPath) : '/'
  const href = path.startsWith('http') ? path : `${SITE_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`

  let link = document.querySelector('link[rel="canonical"]')
  if (!link) {
    link = document.createElement('link')
    link.setAttribute('rel', 'canonical')
    document.head.appendChild(link)
  }
  link.setAttribute('href', href)

  upsertOg('og:title', nextTitle)
  upsertOg('og:description', nextDescription)
  upsertOg('og:url', href)
}

export function resetPageSeo() {
  setPageSeo({ title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION, canonicalPath: '/' })
}

export { DEFAULT_TITLE, DEFAULT_DESCRIPTION, SITE_ORIGIN }
