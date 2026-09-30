import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import i18n from '../../i18n'
import useUiStore from '../../hooks/useUi'
import api from '../../lib/api'
import { postAuthNavigate } from '../../lib/postAuth'
import AuthPage from './AuthPage'

vi.mock('../../lib/api', () => ({
  default: { post: vi.fn(), get: vi.fn(), patch: vi.fn() },
}))

vi.mock('../../lib/postAuth', async (importOriginal) => ({
  ...(await importOriginal()),
  postAuthNavigate: vi.fn(),
}))

vi.mock('../../components/auth/PublicGoogleSignIn', () => ({
  default: ({ label, className }) => (
    <div className={className}>
      <button type="button">{label}</button>
    </div>
  ),
}))

const SECRET = 'Adm1n-Secret!'

function renderAt(url) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <AuthPage />
    </MemoryRouter>,
  )
}

function passwordField() {
  return document.getElementById('admin-password')
}

describe('AuthPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('az')
    useUiStore.setState({ theme: 'light' })
    vi.mocked(api.post).mockReset()
    vi.mocked(postAuthNavigate).mockReset()
  })

  it('normal /login shows only Google sign-in: no password form, no admin notice', () => {
    renderAt('/login')
    expect(screen.getByRole('button', { name: 'Google ilə davam et' })).toBeInTheDocument()
    expect(passwordField()).toBeNull()
    expect(screen.queryByText(/idarəçi hesabları/)).toBeNull()
    expect(screen.queryByText('Admin panel')).toBeNull()
  })

  it.each(['/login?admin=true', '/login?next=%2Fadmin%2Fusers'])('%s shows the admin password form', (url) => {
    renderAt(url)
    expect(passwordField()).toHaveAttribute('type', 'password')
    expect(passwordField()).toHaveAttribute('autocomplete', 'current-password')
    expect(screen.getByLabelText('Telefon və ya email')).toHaveAttribute('autocomplete', 'username')
    expect(screen.getByRole('button', { name: 'Google ilə davam et' })).toBeInTheDocument()
  })

  it('admin notice is neutral (not error-red) and describes the form', () => {
    renderAt('/login?admin=true')
    const notice = screen.getByText(/Şifrə ilə giriş yalnız idarəçi hesabları üçündür/)
    expect(notice.className).not.toMatch(/red/)
    expect(notice).not.toHaveAttribute('role', 'alert')
    expect(notice.closest('form')).toHaveAttribute('aria-describedby', notice.id)
  })

  it('does not render a forgot-password link while reset is gated off', () => {
    renderAt('/login?admin=true')
    expect(screen.queryByRole('link', { name: /unut/i })).toBeNull()
  })

  it('adds no phone/SMS/OTP verification UI', () => {
    const { container } = renderAt('/login?admin=true')
    expect(container.textContent).not.toMatch(/SMS|OTP|WhatsApp/i)
    expect(container.querySelector('input[autocomplete="one-time-code"]')).toBeNull()
  })

  it('toggling visibility never submits the login form', async () => {
    const user = userEvent.setup()
    renderAt('/login?admin=true')
    await user.type(passwordField(), SECRET)
    await user.click(screen.getByRole('button', { name: 'Şifrəni göstər' }))
    expect(passwordField()).toHaveAttribute('type', 'text')
    expect(api.post).not.toHaveBeenCalled()
  })

  it('rejects an invalid identifier with an accessible inline error and no request', async () => {
    const user = userEvent.setup()
    renderAt('/login?admin=true')
    const id = screen.getByLabelText('Telefon və ya email')
    await user.type(id, 'admin')
    await user.type(passwordField(), SECRET)
    await user.click(screen.getByRole('button', { name: 'Daxil ol' }))
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Düzgün email ünvanı və ya telefon nömrəsi daxil edin.')
    expect(id).toHaveAttribute('aria-invalid', 'true')
    expect(id).toHaveAttribute('aria-describedby', alert.id)
    expect(api.post).not.toHaveBeenCalled()
  })

  it.each(['admin@edupanel.co', '+994 50 123 45 67'])('submits a valid identifier (%s) to /auth/login', async (value) => {
    vi.mocked(api.post).mockResolvedValue({ token: 't', user: { id: 1, role: 'admin' } })
    const user = userEvent.setup()
    renderAt('/login?admin=true')
    await user.type(screen.getByLabelText('Telefon və ya email'), value)
    await user.type(passwordField(), SECRET)
    await user.click(screen.getByRole('button', { name: 'Daxil ol' }))
    expect(api.post).toHaveBeenCalledWith('/auth/login', { identifier: value, password: SECRET })
    expect(postAuthNavigate).toHaveBeenCalled()
  })

  it('shows a server login error as an alert linked to the password field, without logging the password', async () => {
    const spies = ['log', 'info', 'warn', 'error', 'debug'].map((m) => vi.spyOn(console, m))
    vi.mocked(api.post).mockRejectedValue(new Error('Giriş məlumatları yanlışdır'))
    const user = userEvent.setup()
    renderAt('/login?admin=true')
    await user.type(screen.getByLabelText('Telefon və ya email'), 'admin@edupanel.co')
    await user.type(passwordField(), SECRET)
    await user.click(screen.getByRole('button', { name: 'Şifrəni göstər' }))
    await user.click(screen.getByRole('button', { name: 'Daxil ol' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Giriş məlumatları yanlışdır')
    expect(passwordField()).toHaveAttribute('aria-describedby', alert.id)
    expect(passwordField()).toHaveAttribute('type', 'password')
    for (const spy of spies) {
      const text = spy.mock.calls.map((args) => args.map(String).join(' ')).join('\n')
      expect(text).not.toContain(SECRET)
      spy.mockRestore()
    }
  })

  it('has no nested interactive elements on the admin login screen', () => {
    const { container } = renderAt('/login?admin=true')
    const interactive = container.querySelectorAll('a, button, input, select, textarea')
    expect(interactive.length).toBeGreaterThan(0)
    for (const el of interactive) {
      expect(el.parentElement.closest('a, button')).toBeNull()
    }
  })

  it('renders in dark mode with the dark icon token', () => {
    useUiStore.setState({ theme: 'dark' })
    renderAt('/login?admin=true')
    const form = passwordField().closest('form')
    const toggle = within(form).getByRole('button', { name: 'Şifrəni göstər' })
    expect(toggle.className).toContain('text-gray-300')
    expect(screen.getByText(/idarəçi hesabları/).className).not.toMatch(/red/)
  })
})
