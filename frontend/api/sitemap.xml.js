const DEFAULT_API_ORIGIN = 'https://api.edupanel.co'

function upstreamOrigin() {
  return String(process.env.MENTORIX_API_ORIGIN || DEFAULT_API_ORIGIN)
    .trim()
    .replace(/\/+$/, '')
}

export default async function handler(req, res) {
  if (req.method && req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).send('Method Not Allowed')
  }

  try {
    const response = await fetch(`${upstreamOrigin()}/api/public/sitemap.xml`, {
      headers: { accept: 'application/xml, text/xml;q=0.9' },
      signal: AbortSignal.timeout(8000),
    })
    const xml = await response.text()
    res.setHeader('Content-Type', 'application/xml; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600')
    return res.status(response.ok ? 200 : 502).send(xml || 'Sitemap unavailable')
  } catch (error) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    return res.status(503).send(error?.name === 'TimeoutError' ? 'Sitemap upstream timeout' : 'Sitemap unavailable')
  }
}
