const SITE_ORIGIN = 'https://mentorix.io'

const DEFAULT_TITLE = 'Mentorix — müəllimlər üçün tələbə, ödəniş və davamiyyət paneli'
const DEFAULT_DESCRIPTION =
  'Mentorix: fərdi müəllim və təlimçilər üçün tələbə idarəetməsi, dərs cədvəli, ödənişlər, davamiyyət, imtahan və analitika. Azərbaycanda repetitor axtarışı.'

/**
 * SPA səhifələri üçün title, description, canonical (Google indeksi).
 */
export function setPageSeo({ title, description, canonicalPath }) {
  if (typeof document === 'undefined') return

  document.title = title || DEFAULT_TITLE

  let meta = document.querySelector('meta[name="description"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('name', 'description')
    document.head.appendChild(meta)
  }
  meta.setAttribute('content', description || DEFAULT_DESCRIPTION)

  const path = canonicalPath != null ? String(canonicalPath) : '/'
  const href = path.startsWith('http') ? path : `${SITE_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`

  let link = document.querySelector('link[rel="canonical"]')
  if (!link) {
    link = document.createElement('link')
    link.setAttribute('rel', 'canonical')
    document.head.appendChild(link)
  }
  link.setAttribute('href', href)
}

export function resetPageSeo() {
  setPageSeo({ title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION, canonicalPath: '/' })
}

export { DEFAULT_TITLE, DEFAULT_DESCRIPTION, SITE_ORIGIN }
