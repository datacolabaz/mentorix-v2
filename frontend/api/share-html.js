/**
 * Vercel serverless: returns index.html with server-rendered Open Graph / Twitter meta
 * for allowlisted share URLs, so WhatsApp, Telegram, Facebook, LinkedIn, Slack,
 * Discord and iMessage crawlers get a branded card without running JavaScript.
 *
 * vercel.json rewrites share routes to /api/share-html?path=/<original path>.
 * Content comes from the backend (MENTORIX_API_ORIGIN, default https://api.edupanel.co).
 */
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import {
  canonicalOrigin,
  fetchSharePreview,
  injectShareMeta,
  ogImageUrl,
  requestOrigin,
  sharePathFromQuery,
} from './_lib/sharePreview.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function readIndexHtml(req) {
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
    requestOrigin(req),
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
    const path = sharePathFromQuery(req.query)
    let html = await readIndexHtml(req)
    const preview = await fetchSharePreview(path)
    html = injectShareMeta(html, preview, {
      canonicalBase: canonicalOrigin(req),
      imageUrl: ogImageUrl(requestOrigin(req), preview, path),
    })

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=600')
    return res.status(200).send(html)
  } catch (err) {
    return res.status(500).send(err?.message || 'share-html error')
  }
}

export const config = {
  runtime: 'nodejs',
}
