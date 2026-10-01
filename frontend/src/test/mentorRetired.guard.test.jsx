import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { describe, expect, it } from 'vitest'

/**
 * The mentor role/section is retired; the only roles are Təlimçi, Tələbə, Valideyn and Admin.
 * Fails on standalone "mentor" wording (any language) in user-facing frontend source, locales,
 * SEO files (index.html, public/, vercel.json, api/) and shared constants.
 * The brand (Mentorix, MentorixAI, mentorix.io) is not a hit.
 */

const FRONTEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const REPO = path.resolve(FRONTEND, '..')
const TERM_RE = /(?<![a-z])mentor(?!ix)|mentee|(?<!\p{L})(?:ментор|наставник|менти(?!\p{L}))/iu
const TEXT_EXT = new Set(['.js', '.jsx', '.mjs', '.cjs', '.json', '.css', '.html', '.xml', '.txt', '.webmanifest', '.svg', '.md'])

/**
 * Lines allowed to keep the word, each with the reason it has to stay. Only lines matching
 * `lines` are allowed; any other mention in the same file still fails.
 */
const ALLOWLIST = [
  {
    file: 'frontend/src/lib/retiredRoutes.js',
    lines: /^\s*\* URLs of the retired mentorship product|^\s*\{ from: '\/[a-z/-]+', to: '\/[a-z/-]+' \},$|^\s*'\/[a-z/*-]+',$/,
    reason: 'list of old URLs that must keep redirecting (301) or showing the retired page',
  },
  {
    file: 'frontend/vercel.json',
    lines: /^\s*"(source|destination)": "\/[a-z/:+-]*(\?path=\/[a-z/-]+)?",?$/,
    reason: 'server-side mirror of retiredRoutes.js: 301 redirects and 410 rewrites for old URLs',
  },
  {
    file: 'shared/personas.mjs',
    lines: /^\s*mentor: PERSONAS\.TEACHER,$/,
    reason: 'legacy alias: a persona stored as "mentor" (old sessions, cached users) is read as the trainer persona',
  },
]

const SKIP_DIRS = new Set(['node_modules', 'dist', '.vercel', 'coverage'])

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    const st = fs.statSync(full)
    if (st.isDirectory()) {
      if (!SKIP_DIRS.has(name)) walk(full, out)
    } else if (TEXT_EXT.has(path.extname(name)) && !/\.test\.jsx?$/.test(name)) {
      out.push(full)
    }
  }
  return out
}

const rel = (f) => path.relative(REPO, f).replace(/\\/g, '/')

function scannedFiles() {
  return [
    ...walk(path.join(FRONTEND, 'src')),
    ...walk(path.join(FRONTEND, 'public')),
    ...walk(path.join(FRONTEND, 'api')),
    ...walk(path.join(REPO, 'shared')),
    path.join(FRONTEND, 'index.html'),
    path.join(FRONTEND, 'vercel.json'),
  ]
}

describe('retired mentor terminology', () => {
  it('no standalone mentor wording outside the reasoned allowlist', () => {
    const files = scannedFiles()
    expect(files.length).toBeGreaterThan(300)
    const hits = []
    for (const f of files) {
      const r = rel(f)
      const entry = ALLOWLIST.find((a) => a.file === r)
      fs.readFileSync(f, 'utf8')
        .split(/\r?\n/)
        .forEach((line, i) => {
          if (!TERM_RE.test(line)) return
          if (entry && entry.lines.test(line)) return
          hits.push(`${r}:${i + 1}: ${line.trim().slice(0, 160)}`)
        })
    }
    expect(hits).toEqual([])
  })

  it('every allowlist entry has a reason and still matches a real line', () => {
    for (const entry of ALLOWLIST) {
      expect(entry.reason.length, entry.file).toBeGreaterThan(20)
      const lines = fs.readFileSync(path.join(REPO, entry.file), 'utf8').split(/\r?\n/)
      expect(lines.some((l) => TERM_RE.test(l) && entry.lines.test(l)), `${entry.file}: stale entry`).toBe(true)
    }
  })

  it('keeps the brand and catches the retired term', () => {
    for (const brand of ['Mentorix', 'MentorixAI', 'mentorix.io', 'MENTORIX', 'mentorixSeoSchema']) {
      expect(brand).not.toMatch(TERM_RE)
    }
    for (const term of ['mentor', 'Mentorluq', 'Mentee', 'ментор', 'Наставник', 'менти']) {
      expect(term).toMatch(TERM_RE)
    }
    expect('документирование').not.toMatch(TERM_RE)
  })

  it('brand strings are still present (the cleanup did not touch them)', () => {
    const brandSrc = fs.readFileSync(path.join(FRONTEND, 'src/config/brand.js'), 'utf8')
    expect(brandSrc).toMatch(/name: 'Mentorix',/)
    expect(brandSrc).toMatch(/domain: 'mentorix\.io',/)
  })
})
