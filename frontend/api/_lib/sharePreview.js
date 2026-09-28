/**
 * Shared by api/share-html.js (meta injection) and api/og.js (image rendering).
 * Preview content comes only from the backend allowlist endpoint
 * GET /api/public/share-preview?path=..., which strips private data.
 */

export const BRAND = Object.freeze({ name: 'Sualix', tagline: 'İmtahan • Tapşırıq • Nəticə' })

export const OG_IMAGE_WIDTH = 1200
export const OG_IMAGE_HEIGHT = 630

const DEFAULT_API_ORIGIN = 'https://api.edupanel.co'

export const FALLBACK_PREVIEW = Object.freeze({
  success: true,
  kind: 'home',
  site_name: BRAND.name,
  title: `${BRAND.name} — İmtahan, tapşırıq və nəticə platforması`,
  description:
    'Müəllimlər üçün imtahan, tapşırıq və material idarəetməsi. Tələbələr üçün daha aydın nəticə və inkişaf.',
  canonical_path: '/',
  image_alt: `${BRAND.name} — İmtahan, tapşırıq və nəticə platforması`,
  card: {
    eyebrow: 'İmtahan, tapşırıq və nəticə platforması',
    title: 'Müəllim üçün idarəetmə, tələbə üçün aydın nəticə',
    lines: ['İmtahan · Tapşırıq · Material · Nəticə'],
    footnote: '',
  },
  version: 'fallback',
  og_type: 'website',
})

export function apiOrigin() {
  const fromEnv = String(process.env.MENTORIX_API_ORIGIN || '').trim().replace(/\/+$/, '')
  return fromEnv || DEFAULT_API_ORIGIN
}

/** Canonical site for og:url. Set PUBLIC_SITE_ORIGIN=https://sualix.co once the domain is live. */
export function canonicalOrigin(req) {
  const fromEnv = String(process.env.PUBLIC_SITE_ORIGIN || '').trim().replace(/\/+$/, '')
  return fromEnv || requestOrigin(req)
}

/** Origin actually serving this request, so og:image always resolves. */
export function requestOrigin(req) {
  const host = String(req?.headers?.['x-forwarded-host'] || req?.headers?.host || '').split(',')[0].trim()
  if (!host) return 'https://mentorix.io'
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)
  const proto = String(req?.headers?.['x-forwarded-proto'] || (local ? 'http' : 'https')).split(',')[0].trim()
  return `${proto}://${host}`
}

export function sharePathFromQuery(query) {
  const raw = Array.isArray(query?.path) ? query.path[0] : query?.path
  const p = String(raw || '/').trim()
  if (!p.startsWith('/') || p.startsWith('//') || p.length > 300) return '/'
  return p.split(/[?#]/)[0] || '/'
}

export async function fetchSharePreview(path, { timeoutMs = 4000 } = {}) {
  try {
    const r = await fetch(`${apiOrigin()}/api/public/share-preview?path=${encodeURIComponent(path)}`, {
      headers: { Accept: 'application/json', 'Accept-Language': 'az' },
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!r.ok) return FALLBACK_PREVIEW
    const d = await r.json()
    if (!d?.success || !d.card) return FALLBACK_PREVIEW
    return d
  } catch {
    return FALLBACK_PREVIEW
  }
}

export function ogImageUrl(origin, preview, path) {
  const params = new URLSearchParams({ path: preview?.canonical_path || path || '/', v: String(preview?.version || '1') })
  return `${origin}/api/og?${params.toString()}`
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const MANAGED_TAG_PATTERNS = [
  /<title>[\s\S]*?<\/title>\s*/gi,
  /<meta\s+name="description"[^>]*>\s*/gi,
  /<meta\s+property="og:[^"]*"[^>]*>\s*/gi,
  /<meta\s+name="twitter:[^"]*"[^>]*>\s*/gi,
  /<link\s+rel="canonical"[^>]*>\s*/gi,
]

/** Replaces every title/description/OG/Twitter/canonical tag with one consistent block. */
export function injectShareMeta(html, preview, { canonicalBase, imageUrl }) {
  const url = `${canonicalBase}${preview.canonical_path || '/'}`
  const tags = [
    `<title>${escapeHtml(preview.title)}</title>`,
    `<meta name="description" content="${escapeHtml(preview.description)}" />`,
    `<link rel="canonical" href="${escapeHtml(url)}" />`,
    `<meta property="og:site_name" content="${escapeHtml(BRAND.name)}" />`,
    `<meta property="og:type" content="${escapeHtml(preview.og_type || 'website')}" />`,
    `<meta property="og:locale" content="az_AZ" />`,
    `<meta property="og:url" content="${escapeHtml(url)}" />`,
    `<meta property="og:title" content="${escapeHtml(preview.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(preview.description)}" />`,
    `<meta property="og:image" content="${escapeHtml(imageUrl)}" />`,
    `<meta property="og:image:secure_url" content="${escapeHtml(imageUrl)}" />`,
    `<meta property="og:image:type" content="image/png" />`,
    `<meta property="og:image:width" content="${OG_IMAGE_WIDTH}" />`,
    `<meta property="og:image:height" content="${OG_IMAGE_HEIGHT}" />`,
    `<meta property="og:image:alt" content="${escapeHtml(preview.image_alt || preview.title)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(preview.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(preview.description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />`,
    `<meta name="twitter:image:alt" content="${escapeHtml(preview.image_alt || preview.title)}" />`,
  ]
  let out = String(html)
  for (const re of MANAGED_TAG_PATTERNS) out = out.replace(re, '')
  return out.replace(/<head>/i, `<head>\n    ${tags.join('\n    ')}`)
}
