/**
 * Vercel serverless: same-origin /api/* → Railway (or any) Express API.
 * Set in Vercel → Environment Variables (Production + Preview):
 *   MENTORIX_API_ORIGIN=https://your-service.up.railway.app
 * (no trailing slash; do not include /api — we append /api/... from the path)
 *
 * If you already set VITE_API_URL to a full backend URL at build time, the browser
 * talks to Railway directly and this handler is unused.
 */
function upstreamBase() {
  const raw = (process.env.MENTORIX_API_ORIGIN || '').trim().replace(/\/+$/, '')
  return raw || null
}

function slugParts(query) {
  const s = query?.slug
  if (s == null) return []
  return Array.isArray(s) ? s.map(String) : [String(s)]
}

export default async function handler(req, res) {
  const base = upstreamBase()
  if (!base) {
    return res.status(503).json({
      success: false,
      message:
        'API proxy disabled: set MENTORIX_API_ORIGIN in Vercel env to your backend origin (e.g. https://xxx.up.railway.app), redeploy.',
    })
  }

  const parts = slugParts(req.query)
  const apiPath = `/api/${parts.join('/')}`

  let incoming
  try {
    incoming = new URL(req.url, 'http://local')
  } catch {
    incoming = { search: '' }
  }
  const target = `${base}${apiPath}${incoming.search || ''}`

  const hopByHop = new Set(['connection', 'keep-alive', 'transfer-encoding', 'host', 'content-length'])
  const headers = new Headers()
  for (const [k, v] of Object.entries(req.headers)) {
    if (!k || hopByHop.has(k.toLowerCase())) continue
    if (v === undefined) continue
    if (Array.isArray(v)) for (const item of v) headers.append(k, item)
    else headers.set(k, v)
  }

  const method = (req.method || 'GET').toUpperCase()
  const hasBody = !['GET', 'HEAD'].includes(method)

  let body
  if (hasBody) {
    if (Buffer.isBuffer(req.body)) body = req.body
    else if (typeof req.body === 'string') body = req.body
    else if (req.body != null && typeof req.body === 'object') body = JSON.stringify(req.body)
  }

  let r
  try {
    r = await fetch(target, {
      method,
      headers,
      body: hasBody ? body : undefined,
      redirect: 'manual',
    })
  } catch (e) {
    return res.status(502).json({
      success: false,
      message: e?.message || 'Upstream fetch failed',
    })
  }

  res.status(r.status)
  r.headers.forEach((value, key) => {
    const lk = key.toLowerCase()
    if (['transfer-encoding', 'connection'].includes(lk)) return
    res.setHeader(key, value)
  })

  const buf = Buffer.from(await r.arrayBuffer())
  return res.send(buf)
}
