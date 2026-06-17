import {
  MENTORIX_SEO_DESCRIPTION,
  MENTORIX_SEO_KEYWORDS,
  MENTORIX_SEO_TITLE,
} from './mentorixPublicMarketing'
import { SITE_ORIGIN, buildBreadcrumbSchema, buildPersonSchema, buildPricingProductSchema } from './mentorixSeoSchema'

const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/og.svg?v=5`

const DEFAULT_TITLE = MENTORIX_SEO_TITLE
const DEFAULT_DESCRIPTION = MENTORIX_SEO_DESCRIPTION
const DEFAULT_KEYWORDS = MENTORIX_SEO_KEYWORDS

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

function upsertJsonLd(id, data) {
  if (!data) {
    const existing = document.getElementById(id)
    if (existing) existing.remove()
    return
  }
  let el = document.getElementById(id)
  if (!el) {
    el = document.createElement('script')
    el.type = 'application/ld+json'
    el.id = id
    document.head.appendChild(el)
  }
  el.textContent = JSON.stringify(data)
}

function absoluteHref(path) {
  const p = path != null ? String(path) : '/'
  return p.startsWith('http') ? p : `${SITE_ORIGIN}${p.startsWith('/') ? p : `/${p}`}`
}

/**
 * SPA səhifələri üçün title, description, canonical, OG/Twitter və breadcrumb schema.
 */
export function setPageSeo({
  title,
  description,
  canonicalPath,
  keywords,
  ogImage,
  ogType = 'website',
  breadcrumbs,
  person,
  pricingProduct = false,
}) {
  if (typeof document === 'undefined') return

  const nextTitle = title || DEFAULT_TITLE
  const nextDescription = description || DEFAULT_DESCRIPTION
  const nextKeywords = keywords || DEFAULT_KEYWORDS
  const href = absoluteHref(canonicalPath)
  const image = ogImage || DEFAULT_OG_IMAGE

  document.title = nextTitle

  upsertMeta('description', nextDescription)
  upsertMeta('keywords', nextKeywords)
  upsertMeta('robots', 'index, follow')

  let link = document.querySelector('link[rel="canonical"]')
  if (!link) {
    link = document.createElement('link')
    link.setAttribute('rel', 'canonical')
    document.head.appendChild(link)
  }
  link.setAttribute('href', href)

  upsertOg('og:site_name', 'Mentorix.io')
  upsertOg('og:title', nextTitle)
  upsertOg('og:description', nextDescription)
  upsertOg('og:url', href)
  upsertOg('og:type', ogType)
  upsertOg('og:image', image)
  upsertOg('og:image:type', 'image/svg+xml')
  upsertOg('og:image:width', '1200')
  upsertOg('og:image:height', '630')
  upsertOg('og:locale', 'az_AZ')

  upsertMeta('twitter:card', 'summary_large_image')
  upsertMeta('twitter:title', nextTitle)
  upsertMeta('twitter:description', nextDescription)
  upsertMeta('twitter:image', image)

  upsertJsonLd('mx-breadcrumb-ld', buildBreadcrumbSchema(breadcrumbs))
  upsertJsonLd('mx-person-ld', person ? buildPersonSchema(person) : null)
  upsertJsonLd('mx-pricing-ld', pricingProduct ? buildPricingProductSchema() : null)
}

export function clearPageStructuredData() {
  if (typeof document === 'undefined') return
  upsertJsonLd('mx-person-ld', null)
  upsertJsonLd('mx-pricing-ld', null)
  upsertJsonLd('mx-breadcrumb-ld', null)
}

export function resetPageSeo() {
  clearPageStructuredData()
  setPageSeo({
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    canonicalPath: '/',
    keywords: DEFAULT_KEYWORDS,
    breadcrumbs: [{ name: 'Mentorix', path: '/' }],
  })
}

export { DEFAULT_TITLE, DEFAULT_DESCRIPTION, DEFAULT_KEYWORDS, SITE_ORIGIN }
