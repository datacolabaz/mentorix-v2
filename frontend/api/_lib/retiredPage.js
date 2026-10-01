/**
 * HTML for URLs of retired product sections: the SPA shell (so the client renders
 * the "Bu səhifə artıq mövcud deyil" page) marked noindex, served with HTTP 410.
 */
const NOINDEX = '<meta name="robots" content="noindex, follow" />'

export const RETIRED_FALLBACK_HTML = `<!doctype html>
<html lang="az">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
${NOINDEX}
<title>Bu səhifə artıq mövcud deyil — Mentorix</title>
</head>
<body>
<main style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1rem;text-align:center">
<h1>Bu səhifə artıq mövcud deyil</h1>
<p><a href="/">Ana səhifə</a></p>
</main>
</body>
</html>
`

export function retiredHtml(indexHtml) {
  const html = typeof indexHtml === 'string' ? indexHtml : ''
  if (!/<head[^>]*>/i.test(html)) return RETIRED_FALLBACK_HTML
  const withoutRobots = html.replace(/<meta\s+name=["']robots["'][^>]*>\s*/gi, '')
  const withoutCanonical = withoutRobots.replace(/<link\s+rel=["']canonical["'][^>]*>\s*/gi, '')
  return withoutCanonical.replace(/<head([^>]*)>/i, `<head$1>\n    ${NOINDEX}`)
}
