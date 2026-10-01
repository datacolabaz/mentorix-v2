import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { describe, expect, it } from 'vitest'

/**
 * Vite inlines import.meta.env as a full object (every VITE_* var, e.g. the Vercel commit
 * message) wherever it is not followed by a static `.KEY` access. Only property access such as
 * import.meta.env.VITE_API_URL / .MODE / .DEV / .PROD / .BASE_URL is allowed in shipped code.
 */

const FRONTEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const ROOTS = [path.join(FRONTEND, 'src'), path.join(FRONTEND, '..', 'shared')]
const CODE_EXT = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx'])
const SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage'])
const WHOLE_ENV_RE = /import\.meta\.env(?!\.[A-Za-z_$])|import\.meta\s*\[/

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(path.join(dir, entry.name), out)
    } else if (CODE_EXT.has(path.extname(entry.name)) && !/\.test\.[jt]sx?$/.test(entry.name)) {
      out.push(path.join(dir, entry.name))
    }
  }
  return out
}

const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:\\])\/\/.*$/gm, '$1')

describe('import.meta.env is only read key by key', () => {
  it('no source file passes import.meta.env as a whole object', () => {
    const hits = []
    for (const file of ROOTS.flatMap((r) => walk(r))) {
      stripComments(fs.readFileSync(file, 'utf8'))
        .split(/\r?\n/)
        .forEach((line, i) => {
          if (WHOLE_ENV_RE.test(line)) hits.push(`${path.relative(FRONTEND, file)}:${i + 1}: ${line.trim()}`)
        })
    }
    expect(hits).toEqual([])
  })

  it('detects whole-object usage', () => {
    for (const bad of ['resolveBrand(import.meta.env)', 'import.meta.env?.VITE_X', '{ ...import.meta.env }', "import.meta['env']", 'Object.entries(import.meta.env)']) {
      expect(WHOLE_ENV_RE.test(bad), bad).toBe(true)
    }
    for (const ok of ['import.meta.env.VITE_API_URL', 'import.meta.env.MODE', 'import.meta.env.DEV && import.meta.env.PROD', 'import.meta.env.BASE_URL']) {
      expect(WHOLE_ENV_RE.test(ok), ok).toBe(false)
    }
  })
})
