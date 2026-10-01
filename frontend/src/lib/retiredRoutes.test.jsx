import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Navigate, Route, Routes, matchPath, useLocation } from 'react-router-dom'
import '../i18n'
import i18n from '../i18n'
import RetiredPage from '../pages/public/RetiredPage'
import { RETIRED_PAGES, RETIRED_REDIRECTS } from './retiredRoutes'
import vercelConfig from '../../vercel.json'
import { retiredHtml, RETIRED_FALLBACK_HTML } from '../../api/_lib/retiredPage.js'
import appSrc from '../App.jsx?raw'

const isRetired = (p) => RETIRED_PAGES.some((pattern) => matchPath({ path: pattern, end: true }, p))
const isRedirected = (p) => RETIRED_REDIRECTS.some((r) => r.from === p)
const vercelSource = (p) => (p.endsWith('/*') ? `${p.slice(0, -2)}/:rest+` : p)

function Where() {
  const { pathname } = useLocation()
  return <p data-testid="where">{pathname}</p>
}

function renderAt(url) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        {RETIRED_REDIRECTS.map((r) => (
          <Route key={r.from} path={r.from} element={<Navigate to={r.to} replace />} />
        ))}
        {RETIRED_PAGES.map((p) => (
          <Route key={p} path={p} element={<RetiredPage />} />
        ))}
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('retired mentor URLs', () => {
  it('redirect targets are live pages: never retired, never redirected again (no loops)', () => {
    for (const { from, to } of RETIRED_REDIRECTS) {
      expect(to, from).not.toBe(from)
      expect(isRedirected(to), `${from} -> ${to} chains`).toBe(false)
      expect(isRetired(to), `${from} -> ${to} lands on a retired page`).toBe(false)
      expect(to).not.toMatch(/mentor(?!ix)/i)
    }
  })

  it('vercel.json serves every redirect as a 301 and every retired page through the 410 function', () => {
    for (const { from, to } of RETIRED_REDIRECTS) {
      const rule = vercelConfig.redirects.find((r) => r.source === from)
      expect(rule, from).toBeTruthy()
      expect(rule.destination).toBe(to)
      expect(rule.statusCode).toBe(301)
    }
    const retiredRewrites = vercelConfig.rewrites.filter((r) => r.destination.startsWith('/api/retired'))
    expect(retiredRewrites.map((r) => r.source).sort()).toEqual(RETIRED_PAGES.map(vercelSource).sort())
    const spaFallback = vercelConfig.rewrites.findIndex((r) => r.destination === '/index.html')
    const studentBot = vercelConfig.rewrites.findIndex((r) => r.source === '/student/:rest*')
    for (const r of retiredRewrites) {
      const at = vercelConfig.rewrites.indexOf(r)
      expect(at).toBeLessThan(spaFallback)
      expect(at).toBeLessThan(studentBot)
    }
    expect(vercelConfig.functions['api/retired.js']).toEqual({ includeFiles: 'dist/index.html' })
  })

  it('App.jsx wires both lists into the router', () => {
    expect(appSrc).toMatch(/RETIRED_REDIRECTS\.map\(/)
    expect(appSrc).toMatch(/RETIRED_PAGES\.map\(/)
  })

  it.each(RETIRED_REDIRECTS.map((r) => [r.from, r.to]))('%s redirects to %s', (from, to) => {
    renderAt(from)
    expect(screen.getByTestId('where').textContent).toBe(to)
  })

  it.each(['/mentorship', '/mentorship/goals', '/mentorship/safety', '/mentor/connections', '/student/mentorship', '/instructor/roadmap'])(
    '%s shows the retired page',
    async (url) => {
      await i18n.changeLanguage('az')
      renderAt(url)
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Bu səhifə artıq mövcud deyil')
      expect(screen.getByRole('link', { name: 'Ana səhifə' })).toHaveAttribute('href', '/')
      expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex')
    },
  )

  it('unrelated URLs are untouched', () => {
    renderAt('/muellimler-ucun')
    expect(screen.getByTestId('where').textContent).toBe('/muellimler-ucun')
  })

  it('the 410 HTML is the SPA shell marked noindex without the home canonical', () => {
    const shell = '<html><head><meta charset="utf-8"><link rel="canonical" href="https://mentorix.io/"><meta name="robots" content="index, follow"></head><body><div id="root"></div></body></html>'
    const html = retiredHtml(shell)
    expect(html).toMatch(/<meta name="robots" content="noindex, follow" \/>/)
    expect(html).not.toMatch(/rel="canonical"/)
    expect(html).not.toMatch(/index, follow">/)
    expect(html).toMatch(/<div id="root"><\/div>/)
    expect(retiredHtml('')).toBe(RETIRED_FALLBACK_HTML)
    expect(RETIRED_FALLBACK_HTML).toMatch(/Bu səhifə artıq mövcud deyil/)
  })
})
