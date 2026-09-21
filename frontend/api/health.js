/**
 * Public health endpoint for the Vercel frontend domain.
 * MENTORIX_API_ORIGIN is optional; the production API remains the fallback.
 */
const DEFAULT_API_ORIGIN = 'https://api.edupanel.co'

function upstreamOrigin() {
  return String(process.env.MENTORIX_API_ORIGIN || DEFAULT_API_ORIGIN)
    .trim()
    .replace(/\/+$/, '')
}

export default async function handler(req, res) {
  const startedAt = Date.now()
  try {
    const response = await fetch(`${upstreamOrigin()}/api/health`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    })
    const payload = await response.json().catch(() => ({}))
    res.setHeader('Cache-Control', 'no-store')
    return res.status(response.ok ? 200 : 503).json({
      status: response.ok ? 'ok' : 'degraded',
      upstream: payload?.status || (response.ok ? 'ok' : 'unavailable'),
      upstream_status: response.status,
      latency_ms: Date.now() - startedAt,
    })
  } catch (error) {
    res.setHeader('Cache-Control', 'no-store')
    return res.status(503).json({
      status: 'degraded',
      upstream: 'unavailable',
      error: error?.name === 'TimeoutError' ? 'upstream_timeout' : 'upstream_unreachable',
      latency_ms: Date.now() - startedAt,
    })
  }
}
