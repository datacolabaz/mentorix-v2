// Regenerates public/og-default.png (static fallback / homepage image) from the
// current brand env, e.g. `BRAND_NAME=Resulio npm run og:default`.
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
process.chdir(root)
const { renderOgPng } = await import('../api/og.js')
const { fallbackPreview } = await import('../api/_lib/sharePreview.js')
const png = await renderOgPng(fallbackPreview(), '')
writeFileSync(join(root, 'public', 'og-default.png'), png)
console.log(`public/og-default.png: ${png.length} bytes`)
