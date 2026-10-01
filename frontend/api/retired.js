/**
 * Vercel serverless: answers URLs of retired product sections with HTTP 410 Gone.
 * vercel.json rewrites those paths here; the list lives in src/lib/retiredRoutes.js.
 */
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { retiredHtml } from './_lib/retiredPage.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function readIndexHtml() {
  const candidates = [
    join(process.cwd(), 'dist', 'index.html'),
    join(__dirname, '..', 'dist', 'index.html'),
  ]
  for (const p of candidates) {
    try {
      return readFileSync(p, 'utf8')
    } catch {
      /* try next path */
    }
  }
  return ''
}

export default function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('X-Robots-Tag', 'noindex')
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600')
  return res.status(410).send(retiredHtml(readIndexHtml()))
}

export const config = {
  runtime: 'nodejs',
}
