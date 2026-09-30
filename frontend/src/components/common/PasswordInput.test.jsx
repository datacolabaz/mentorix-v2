import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '../../i18n'
import useUiStore from '../../hooks/useUi'
import PasswordInput from './PasswordInput'

const SECRET = 'S3cr3t-Pa55!'

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// Tailwind palette / tokens used by PasswordInput; input backgrounds come from the
// .login-wrapper overrides in index.css (white in light, --surface-secondary #0B0B0F in dark).
const COLORS = {
  white: '#ffffff',
  darkInput: '#0b0b0f',
  slate600: '#475569',
  emerald700: '#047857',
  gray300: '#d1d5db',
  primary: '#00e676',
}

function renderInForm(props = {}, onSubmit = vi.fn((e) => e.preventDefault())) {
  const utils = render(
    <form onSubmit={onSubmit}>
      <label htmlFor="pw">Şifrə</label>
      <PasswordInput id="pw" name="password" defaultValue="" {...props} />
      <button type="submit">Daxil ol</button>
    </form>,
  )
  return { ...utils, onSubmit, input: screen.getByLabelText('Şifrə') }
}

describe('PasswordInput', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('az')
    useUiStore.setState({ theme: 'light' })
  })

  it('is masked by default with current-password autocomplete', () => {
    const { input } = renderInForm()
    expect(input).toHaveAttribute('type', 'password')
    expect(input).toHaveAttribute('autocomplete', 'current-password')
    expect(input).toHaveAttribute('name', 'password')
  })

  it('supports new-password autocomplete for creation/reset forms', () => {
    const { input } = renderInForm({ autoComplete: 'new-password' })
    expect(input).toHaveAttribute('autocomplete', 'new-password')
  })

  it('show reveals the password and hide masks it again, updating aria-label and aria-pressed', async () => {
    const user = userEvent.setup()
    const { input } = renderInForm()
    await user.type(input, SECRET)

    const toggle = screen.getByRole('button', { name: 'Şifrəni göstər' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    expect(toggle).toHaveAttribute('aria-controls', 'pw')

    await user.click(toggle)
    expect(input).toHaveAttribute('type', 'text')
    expect(input).toHaveValue(SECRET)
    expect(toggle).toHaveAccessibleName('Şifrəni gizlət')
    expect(toggle).toHaveAttribute('aria-pressed', 'true')

    await user.click(toggle)
    expect(input).toHaveAttribute('type', 'password')
    expect(toggle).toHaveAccessibleName('Şifrəni göstər')
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
  })

  it('uses English labels when the UI language is en', async () => {
    await i18n.changeLanguage('en')
    const user = userEvent.setup()
    renderInForm()
    const toggle = screen.getByRole('button', { name: 'Show password' })
    await user.click(toggle)
    expect(toggle).toHaveAccessibleName('Hide password')
  })

  it('toggle is a real type="button" and does not submit the form', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderInForm()
    const toggle = screen.getByRole('button', { name: 'Şifrəni göstər' })
    expect(toggle.tagName).toBe('BUTTON')
    expect(toggle).toHaveAttribute('type', 'button')
    await user.click(toggle)
    await user.keyboard('{Enter}')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('is reachable by Tab and toggles with Enter and Space', async () => {
    const user = userEvent.setup()
    const { input } = renderInForm()
    await user.click(input)
    await user.tab()
    const toggle = screen.getByRole('button', { name: 'Şifrəni göstər' })
    expect(toggle).toHaveFocus()

    await user.keyboard('{Enter}')
    expect(input).toHaveAttribute('type', 'text')
    await user.keyboard(' ')
    expect(input).toHaveAttribute('type', 'password')
  })

  it('stays masked after a remount (page reload)', async () => {
    const user = userEvent.setup()
    const first = renderInForm()
    await user.click(screen.getByRole('button', { name: 'Şifrəni göstər' }))
    expect(first.input).toHaveAttribute('type', 'text')
    first.unmount()

    const second = renderInForm()
    expect(second.input).toHaveAttribute('type', 'password')
  })

  it('re-masks on submit so password managers still see a password field', async () => {
    const user = userEvent.setup()
    const { input, onSubmit } = renderInForm()
    await user.type(input, SECRET)
    await user.click(screen.getByRole('button', { name: 'Şifrəni göstər' }))
    expect(input).toHaveAttribute('type', 'text')
    await user.click(screen.getByRole('button', { name: 'Daxil ol' }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(input).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'Şifrəni göstər' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('never writes the password to the console', async () => {
    const spies = ['log', 'info', 'warn', 'error', 'debug'].map((m) => vi.spyOn(console, m))
    const user = userEvent.setup()
    const { input } = renderInForm()
    await user.type(input, SECRET)
    await user.click(screen.getByRole('button', { name: 'Şifrəni göstər' }))
    await user.click(screen.getByRole('button', { name: 'Daxil ol' }))
    for (const spy of spies) {
      const text = spy.mock.calls.map((args) => args.map(String).join(' ')).join('\n')
      expect(text).not.toContain(SECRET)
      spy.mockRestore()
    }
  })

  it('has no nested interactive element and a 44px tap target', () => {
    renderInForm()
    const toggle = screen.getByRole('button', { name: 'Şifrəni göstər' })
    expect(toggle.parentElement.closest('button, a, label, [role="button"]')).toBeNull()
    expect(toggle.querySelector('button, a, input')).toBeNull()
    expect(toggle.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(toggle.className).toMatch(/\bh-11\b/)
    expect(toggle.className).toMatch(/\bw-11\b/)
    expect(screen.getByLabelText('Şifrə').className).toMatch(/\bpr-12\b/)
  })

  it('light mode: icon and focus ring use tokens with sufficient contrast', () => {
    renderInForm({ className: 'bg-white' })
    const toggle = screen.getByRole('button', { name: 'Şifrəni göstər' })
    expect(toggle.className).toContain('text-slate-600')
    expect(toggle.className).toContain('focus-visible:ring-2')
    expect(toggle.className).toContain('focus-visible:ring-emerald-700')
    expect(contrast(COLORS.slate600, COLORS.white)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(COLORS.emerald700, COLORS.white)).toBeGreaterThanOrEqual(3)
  })

  it('dark mode: icon and focus ring use tokens with sufficient contrast', () => {
    useUiStore.setState({ theme: 'dark' })
    renderInForm({ className: 'bg-surface-1' })
    const toggle = screen.getByRole('button', { name: 'Şifrəni göstər' })
    expect(toggle.className).toContain('text-gray-300')
    expect(toggle.className).toContain('focus-visible:ring-primary')
    expect(contrast(COLORS.gray300, COLORS.darkInput)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(COLORS.primary, COLORS.darkInput)).toBeGreaterThanOrEqual(3)
  })
})
