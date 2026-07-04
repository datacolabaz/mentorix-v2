/**
 * Vercel serverless: inject Open Graph meta into index.html for shareable routes.
 * Rewritten from vercel.json for /sertifikatli-imtahanlar/:slug and /exam/:examId.
 *
 * Requires MENTORIX_API_ORIGIN (Railway backend origin, no /api suffix).
 */
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SITE_ORIGIN = 'https://mentorix.io'

function upstreamBase() {
  return (process.env.MENTORIX_API_ORIGIN || '').trim().replace(/\/+$/, '')
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;')
}

function replaceMeta(html, attr, key, content) {
  const safe = escapeHtml(content)
  const re = new RegExp(`<meta ${attr}="${key}" content="[^"]*"\\s*/>`, 'i')
  if (re.test(html)) return html.replace(re, `<meta ${attr}="${key}" content="${safe}" />`)
  return html
}

function replaceTitle(html, title) {
  const safe = escapeHtml(title)
  return html.replace(/<title>[^<]*<\/title>/i, `<title>${safe}</title>`)
}

function replaceCanonical(html, href) {
  const safe = escapeHtml(href)
  const re = /<link rel="canonical" href="[^"]*"\s*\/>/i
  if (re.test(html)) return html.replace(re, `<link rel="canonical" href="${safe}" />`)
  return html
}

function injectPageMeta(html, meta) {
  if (!meta?.title) return html
  let out = html
  out = replaceTitle(out, meta.title)
  out = replaceMeta(out, 'name', 'description', meta.description)
  out = replaceMeta(out, 'property', 'og:title', meta.title)
  out = replaceMeta(out, 'property', 'og:description', meta.description)
  out = replaceMeta(out, 'property', 'og:url', meta.url)
  out = replaceMeta(out, 'property', 'og:image', meta.image)
  out = replaceMeta(out, 'property', 'og:type', meta.og_type || 'website')
  out = replaceMeta(out, 'name', 'twitter:title', meta.title)
  out = replaceMeta(out, 'name', 'twitter:description', meta.description)
  out = replaceMeta(out, 'name', 'twitter:image', meta.image)
  out = replaceCanonical(out, meta.url)
  return out
}

async function fetchOgMeta(kind, params, base) {
  let path = ''
  if (kind === 'category' && params.slug) {
    path = `/api/public/og/certified-category/${encodeURIComponent(params.slug)}`
  } else if (kind === 'exam' && params.examId) {
    path = `/api/public/og/exam/${encodeURIComponent(params.examId)}`
  } else {
    return null
  }

  const r = await fetch(`${base}${path}`, {
    headers: { 'Accept-Language': 'az' },
  })
  if (!r.ok) return null
  const d = await r.json()
  if (!d?.success) return null
  return {
    title: d.title,
    description: d.description,
    url: d.url,
    image: d.image,
    og_type: d.og_type || 'website',
  }
}

async function readIndexHtml() {
  const candidates = [
    join(process.cwd(), 'dist', 'index.html'),
    join(process.cwd(), 'index.html'),
    join(__dirname, '..', 'dist', 'index.html'),
    join(__dirname, '..', 'index.html'),
  ]
  for (const p of candidates) {
    try {
      return readFileSync(p, 'utf8')
    } catch {
      /* try next path */
    }
  }

  const fetchBases = [
    SITE_ORIGIN,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  ].filter(Boolean)

  for (const base of fetchBases) {
    try {
      const r = await fetch(`${String(base).replace(/\/+$/, '')}/index.html`, {
        headers: { Accept: 'text/html' },
        signal: AbortSignal.timeout(8000),
      })
      if (r.ok) return await r.text()
    } catch {
      /* try next origin */
    }
  }

  throw new Error('index.html tapılmadı')
}

export default async function handler(req, res) {
  try {
    const kind = String(req.query?.kind || '').trim()
    const slug = String(req.query?.slug || '').trim()
    const examId = String(req.query?.examId || '').trim()

    let html = await readIndexHtml()
    const base = upstreamBase()

    if (base) {
      try {
        const meta = await fetchOgMeta(kind, { slug, examId }, base)
        if (meta) html = injectPageMeta(html, meta)
      } catch {
        /* fallback to default index.html meta */
      }
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
    return res.status(200).send(html)
  } catch (err) {
    try {
      const r = await fetch(`${SITE_ORIGIN}/index.html`, {
        headers: { Accept: 'text/html' },
        signal: AbortSignal.timeout(8000),
      })
      if (r.ok) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.setHeader('Cache-Control', 'public, s-maxage=60')
        return res.status(200).send(await r.text())
      }
    } catch {
      /* final fallback failed */
    }
    return res.status(500).send(err?.message || 'share-html error')
  }
}

export const config = {
  runtime: 'nodejs',
}
