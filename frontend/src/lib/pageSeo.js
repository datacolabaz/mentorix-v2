import {
  MENTORIX_SEO_DESCRIPTION,
  MENTORIX_SEO_KEYWORDS,
  MENTORIX_SEO_TITLE,
} from './mentorixPublicMarketing'
import { SITE_ORIGIN, buildBreadcrumbSchema, buildPersonSchema, buildPricingProductSchema } from './mentorixSeoSchema'
import { BRAND } from './brand'

export const OG_IMAGE_PATH = '/og.png?v=8'
export const OG_CERTIFIED_IMAGE_PATH = '/og-certified.png?v=1'
export const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}${OG_IMAGE_PATH}`
export const CERTIFIED_OG_IMAGE = `${SITE_ORIGIN}${OG_CERTIFIED_IMAGE_PATH}`

function ogImageMime(url) {
  const path = String(url || '').split('?')[0].toLowerCase()
  if (path.endsWith('.svg')) return 'image/svg+xml'
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg'
  return 'image/png'
}

const DEFAULT_TITLE = MENTORIX_SEO_TITLE
const DEFAULT_DESCRIPTION = MENTORIX_SEO_DESCRIPTION
const DEFAULT_KEYWORDS = MENTORIX_SEO_KEYWORDS

function normalizeSeoBrand(value) {
  return String(value || '').replace(/mentorix(?:\.io)?/gi, BRAND.domain)
}

function buildFaqSchema(items) {
  const entries = (Array.isArray(items) ? items : [])
    .filter((item) => item?.q && item?.a)
    .map((item) => ({
      '@type': 'Question',
      name: String(item.q),
      acceptedAnswer: { '@type': 'Answer', text: String(item.a) },
    }))
  if (!entries.length) return null
  return { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: entries }
}

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
function ogLocale(locale) {
  const l = String(locale || '').toLowerCase()
  if (l.startsWith('ru')) return 'ru_RU'
  if (l.startsWith('en')) return 'en_GB'
  return 'az_AZ'
}

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
  faq,
  locale,
}) {
  if (typeof document === 'undefined') return

   const nextTitle = normalizeSeoBrand(title || DEFAULT_TITLE)
   const nextDescription = normalizeSeoBrand(description || DEFAULT_DESCRIPTION)
   const nextKeywords = normalizeSeoBrand(keywords || DEFAULT_KEYWORDS)
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

   upsertOg('og:site_name', BRAND.domain)
  upsertOg('og:title', nextTitle)
  upsertOg('og:description', nextDescription)
  upsertOg('og:url', href)
  upsertOg('og:type', ogType)
  upsertOg('og:image', image)
  upsertOg('og:image:secure_url', image)
  upsertOg('og:image:type', ogImageMime(image))
  upsertOg('og:image:width', '1200')
  upsertOg('og:image:height', '630')
  upsertOg('og:image:alt', nextTitle)
  upsertOg('og:locale', ogLocale(locale))

  upsertMeta('twitter:card', 'summary_large_image')
  upsertMeta('twitter:title', nextTitle)
  upsertMeta('twitter:description', nextDescription)
  upsertMeta('twitter:image', image)
  upsertMeta('twitter:image:alt', nextTitle)

   const normalizedBreadcrumbs = Array.isArray(breadcrumbs)
     ? breadcrumbs.map((item) => ({ ...item, name: normalizeSeoBrand(item?.name) }))
     : breadcrumbs
   upsertJsonLd('mx-breadcrumb-ld', buildBreadcrumbSchema(normalizedBreadcrumbs))
  upsertJsonLd('mx-person-ld', person ? buildPersonSchema(person) : null)
  upsertJsonLd('mx-pricing-ld', pricingProduct ? buildPricingProductSchema() : null)
  upsertJsonLd('mx-faq-ld', buildFaqSchema(faq))
}

export function clearPageStructuredData() {
  if (typeof document === 'undefined') return
  upsertJsonLd('mx-faq-ld', null)
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
    breadcrumbs: [{ name: BRAND.domain, path: '/' }],
  })
}

export { DEFAULT_TITLE, DEFAULT_DESCRIPTION, DEFAULT_KEYWORDS, SITE_ORIGIN }
