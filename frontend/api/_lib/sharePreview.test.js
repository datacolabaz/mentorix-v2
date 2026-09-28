import test from 'node:test'
import assert from 'node:assert/strict'
import { fallbackPreview, injectShareMeta, ogImageUrl, sharePathFromQuery, canonicalOrigin } from './sharePreview.js'

const HTML = `<!doctype html><html><head>
    <meta charset="UTF-8" />
    <title>old</title>
    <meta name="description" content="old" />
    <link rel="canonical" href="https://mentorix.io/" />
    <meta property="og:title" content="old" />
    <meta property="og:image" content="https://mentorix.io/og.png" />
    <meta name="twitter:card" content="summary" />
    <script type="module" src="/assets/index.js"></script>
  </head><body><div id="root"></div></body></html>`

const preview = {
  ...fallbackPreview(),
  title: 'İmtahana dəvət — "Faizlər" <b>',
  description: 'Riyaziyyat · 20 sual · 30 dəqiqə',
  canonical_path: '/exam/abc',
  version: 'v1',
}

test('meta block replaces every managed tag exactly once and escapes content', () => {
  const out = injectShareMeta(HTML, preview, {
    canonicalBase: 'https://resulio.example',
    imageUrl: ogImageUrl('https://mentorix.io', preview, '/exam/abc'),
  })
  for (const tag of ['property="og:title"', 'property="og:image"', 'name="twitter:card"', 'rel="canonical"', '<title>']) {
    assert.equal(out.split(tag).length - 1, 1, `${tag} should appear once`)
  }
  assert.match(out, /<title>İmtahana dəvət — &quot;Faizlər&quot; &lt;b&gt;<\/title>/)
  assert.match(out, /og:url" content="https:\/\/resulio\.example\/exam\/abc"/)
  assert.match(out, /og:image:secure_url" content="https:\/\/mentorix\.io\/api\/og\?path=%2Fexam%2Fabc&amp;v=v1"/)
  assert.match(out, /og:image:width" content="1200"/)
  assert.match(out, /og:site_name" content="Mentorix"/)
  assert.match(out, /<script type="module" src="\/assets\/index.js"><\/script>/)
  assert.ok(!out.includes('content="old"'))
})

test('share path from query rejects protocol-relative and oversized paths', () => {
  assert.equal(sharePathFromQuery({ path: '/exam/1?x=1' }), '/exam/1')
  assert.equal(sharePathFromQuery({ path: '//evil.com' }), '/')
  assert.equal(sharePathFromQuery({ path: 'https://evil.com' }), '/')
  assert.equal(sharePathFromQuery({ path: `/${'a'.repeat(400)}` }), '/')
  assert.equal(sharePathFromQuery({}), '/')
})

test('canonical origin prefers PUBLIC_SITE_ORIGIN, else the serving host', () => {
  const req = { headers: { host: 'mentorix.io' } }
  delete process.env.PUBLIC_SITE_ORIGIN
  assert.equal(canonicalOrigin(req), 'https://mentorix.io')
  process.env.PUBLIC_SITE_ORIGIN = 'https://resulio.example/'
  assert.equal(canonicalOrigin(req), 'https://resulio.example')
  delete process.env.PUBLIC_SITE_ORIGIN
})

test('fallback preview follows BRAND_NAME without code changes', () => {
  delete process.env.BRAND_NAME
  assert.equal(fallbackPreview().site_name, 'Mentorix')
  process.env.BRAND_NAME = 'Resulio'
  assert.equal(fallbackPreview().title, 'Resulio — İmtahan, qiymətləndirmə və nəticə analizi')
  delete process.env.BRAND_NAME
})
