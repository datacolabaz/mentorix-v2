/**
 * Vercel serverless: 1200×630 PNG preview card.
 *   GET /api/og?path=/exam/<id>&v=<version>
 * The left third is a fixed brand zone (name from BRAND_NAME); the right side shows the
 * privacy-safe card from the backend. Text is never taken from the query string,
 * only the allowlisted path, so the endpoint cannot be used to render arbitrary branded copy.
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { ImageResponse } from '@vercel/og'
import {
  FALLBACK_VERSION,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
  canonicalOrigin,
  currentBrand,
  fallbackPreview,
  fetchSharePreview,
  sharePathFromQuery,
} from './_lib/sharePreview.js'

const COLORS = {
  bg: '#0B1733',
  brandBg: '#081028',
  accent: '#34D399',
  accentSoft: 'rgba(52, 211, 153, 0.14)',
  text: '#FFFFFF',
  muted: '#A5B4CF',
  line: 'rgba(255, 255, 255, 0.10)',
}

let fontCache = null

function loadFonts() {
  if (fontCache) return fontCache
  const dir = join(process.cwd(), 'node_modules', '@fontsource', 'inter', 'files')
  const variants = []
  for (const weight of [400, 600, 800]) {
    for (const subset of ['latin', 'latin-ext']) {
      variants.push({
        // Satori keeps one face per name+weight, so the latin-ext subset needs its own family name.
        name: subset === 'latin' ? 'Inter' : 'InterExt',
        weight,
        style: 'normal',
        data: readFileSync(join(dir, `inter-${subset}-${weight}-normal.woff`)),
      })
    }
  }
  fontCache = variants
  return fontCache
}

const h = (type, style, children) => ({ type, props: { style, children } })

function titleSize(text) {
  const n = String(text || '').length
  if (n <= 28) return 60
  if (n <= 48) return 52
  if (n <= 64) return 46
  return 40
}

function logoMark(size) {
  return {
    type: 'svg',
    props: {
      width: size,
      height: size,
      viewBox: '0 0 64 64',
      children: [
        { type: 'circle', props: { cx: 32, cy: 32, r: 26, fill: 'none', stroke: COLORS.accent, 'stroke-width': 8 } },
        { type: 'circle', props: { cx: 32, cy: 32, r: 10, fill: COLORS.text } },
      ],
    },
  }
}

function brandZone(brand, domain) {
  return h(
    'div',
    {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      width: 420,
      height: '100%',
      padding: '64px 44px',
      backgroundColor: COLORS.brandBg,
      borderRight: `2px solid ${COLORS.line}`,
    },
    [
      h('div', { display: 'flex', flexDirection: 'column' }, [
        h('div', { display: 'flex', alignItems: 'center' }, [
          logoMark(64),
          h('div', { display: 'flex', marginLeft: 18, fontSize: 60, fontWeight: 800, color: COLORS.text, letterSpacing: -1.5 }, brand.name),
        ]),
        h('div', { display: 'flex', marginTop: 28, fontSize: 21, fontWeight: 600, color: COLORS.muted, whiteSpace: 'nowrap' }, brand.tagline),
      ]),
      h('div', { display: 'flex', fontSize: 22, fontWeight: 600, color: COLORS.accent }, domain || ''),
    ],
  )
}

function contentZone(card) {
  const lines = (card.lines || []).filter(Boolean).slice(0, 2)
  return h(
    'div',
    {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      flex: 1,
      height: '100%',
      padding: '64px 64px 60px',
    },
    [
      h('div', { display: 'flex', flexDirection: 'column' }, [
        h(
          'div',
          {
            display: 'flex',
            alignSelf: 'flex-start',
            padding: '10px 22px',
            borderRadius: 999,
            backgroundColor: COLORS.accentSoft,
            color: COLORS.accent,
            fontSize: 26,
            fontWeight: 600,
          },
          card.eyebrow,
        ),
        h(
          'div',
          {
            display: 'block',
            marginTop: 30,
            fontSize: titleSize(card.title),
            fontWeight: 800,
            color: COLORS.text,
            lineHeight: 1.15,
            letterSpacing: -1,
            maxHeight: 3 * 1.15 * titleSize(card.title),
            overflow: 'hidden',
            lineClamp: 3,
          },
          card.title,
        ),
        ...lines.map((line, i) =>
          h(
            'div',
            {
              display: 'block',
              marginTop: i === 0 ? 26 : 10,
              fontSize: 30,
              fontWeight: 400,
              color: COLORS.muted,
              lineHeight: 1.3,
              maxHeight: 2 * 1.3 * 30,
              overflow: 'hidden',
              lineClamp: 2,
            },
            line,
          ),
        ),
      ]),
      card.footnote
        ? h('div', { display: 'flex', alignItems: 'center', fontSize: 28, fontWeight: 600, color: COLORS.text }, [
            h('div', { display: 'flex', width: 12, height: 12, borderRadius: 999, backgroundColor: COLORS.accent, marginRight: 14 }, []),
            card.footnote,
          ])
        : h('div', { display: 'flex' }, []),
    ],
  )
}

export function renderCardTree(preview, domain) {
  const fallback = fallbackPreview()
  const card = preview?.card || fallback.card
  const brand = {
    name: preview?.brand?.name || fallback.brand.name,
    tagline: preview?.brand?.tagline || fallback.brand.tagline,
  }
  return h(
    'div',
    {
      display: 'flex',
      width: '100%',
      height: '100%',
      backgroundColor: COLORS.bg,
      fontFamily: 'Inter, InterExt',
    },
    [brandZone(brand, domain), contentZone(card)],
  )
}

export async function renderOgPng(preview, domain) {
  const image = new ImageResponse(renderCardTree(preview, domain), {
    width: OG_IMAGE_WIDTH,
    height: OG_IMAGE_HEIGHT,
    fonts: loadFonts(),
  })
  return Buffer.from(await image.arrayBuffer())
}

function displayDomain(req) {
  try {
    return new URL(canonicalOrigin(req)).host.replace(/^www\./, '')
  } catch {
    return currentBrand().domain
  }
}

export default async function handler(req, res) {
  const path = sharePathFromQuery(req.query)
  const domain = displayDomain(req)
  let png
  let stable = false
  try {
    const preview = await fetchSharePreview(path)
    stable = preview.version !== FALLBACK_VERSION
    png = await renderOgPng(preview, domain)
  } catch (err) {
    console.error('[og] render failed', err?.message)
    try {
      png = await renderOgPng(fallbackPreview(), domain)
    } catch {
      res.setHeader('Cache-Control', 'public, max-age=60')
      res.statusCode = 302
      res.setHeader('Location', '/og-default.png')
      return res.end()
    }
  }
  res.setHeader('Content-Type', 'image/png')
  res.setHeader('Content-Length', String(png.length))
  res.setHeader(
    'Cache-Control',
    stable && req.query?.v ? 'public, max-age=86400, s-maxage=31536000, immutable' : 'public, max-age=60, s-maxage=300',
  )
  return res.status(200).send(png)
}

export const config = {
  runtime: 'nodejs',
}
