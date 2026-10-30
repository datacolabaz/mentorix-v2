import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import fs from 'node:fs'
import path from 'node:path'
import Button, { buttonClassName } from './Button'
import StatusBadge from './StatusBadge'

describe('Button states', () => {
  it('loading blocks the click even when disabled={false} is passed, and announces progress', async () => {
    const onClick = vi.fn()
    render(
      <Button loading disabled={false} onClick={onClick}>
        Yadda saxla
      </Button>,
    )
    const btn = screen.getByRole('button', { name: /Yadda saxla/ })
    expect(btn.disabled).toBe(true)
    expect(btn.getAttribute('aria-busy')).toBe('true')
    expect(btn.textContent).toMatch(/yüklənir/)
    await userEvent.click(btn)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('disabledReason keeps the button reachable and explains why on tap (phones have no hover)', async () => {
    const onClick = vi.fn()
    render(
      <Button disabled disabledReason="Aylıq limit dolub" onClick={onClick}>
        Yeni tapşırıq
      </Button>,
    )
    const btn = screen.getByRole('button', { name: 'Yeni tapşırıq' })
    expect(btn.getAttribute('aria-disabled')).toBe('true')
    expect(btn.getAttribute('title')).toBe('Aylıq limit dolub')
    expect(btn.getAttribute('aria-describedby')).toBeTruthy()
    await userEvent.click(btn)
    expect(onClick).not.toHaveBeenCalled()
    expect(screen.getByRole('status').textContent).toBe('Aylıq limit dolub')
  })

  it('every variant has a visible focus ring and a distinct disabled look', () => {
    for (const variant of ['primary', 'secondary', 'ghost', 'danger']) {
      for (const theme of ['light', 'dark']) {
        const cls = buttonClassName({ variant, theme })
        expect(cls).toMatch(/focus-visible:ring-2/)
        expect(cls).toMatch(/disabled:opacity-50/)
        expect(cls).toMatch(/aria-disabled:opacity-50/)
      }
    }
  })
})

describe('status colours', () => {
  it('StatusBadge uses theme tokens instead of dark-only palette text', () => {
    const { container } = render(<StatusBadge variant="paid">Ödənilib</StatusBadge>)
    expect(container.firstChild.className).toMatch(/text-success/)
    expect(container.firstChild.className).not.toMatch(/text-emerald-200/)
  })

  it('light theme remaps every pale hue (incl. indigo used by «Analitika») in content, dialogs and menus', () => {
    const css = fs.readFileSync(path.resolve(__dirname, '../../index.css'), 'utf8')
    for (const cls of ['text-indigo-200', 'text-violet-300', 'text-red-300', 'text-blue-300', 'text-indigo-200\\/90']) {
      expect(css.includes(`.${cls}`)).toBe(true)
    }
    expect(css).toMatch(/\.theme-light :is\(\.mx-app-content, \[role="dialog"\], \[role="menu"\]\)/)
  })
})
