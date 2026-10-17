import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import i18n from '../../i18n'
import useUiStore from '../../hooks/useUi'
import useAuthStore from '../../hooks/useAuth'
import api from '../../lib/api'
import AuthPage from './AuthPage'
import LoginChooser from './LoginChooser'
import PortalLogin from './PortalLogin'

vi.mock('../../lib/api', () => ({
  default: { post: vi.fn(), get: vi.fn(), patch: vi.fn() },
}))

// The Google button itself is the existing component; here it only exposes the portal callbacks.
const googleOutcome = { value: null }
vi.mock('../../components/auth/PublicGoogleSignIn', () => ({
  default: ({ label, className, portal, onSuccess, onError }) => (
    <div className={className}>
      <button
        type="button"
        data-portal={portal || ''}
        onClick={async () => {
          const o = googleOutcome.value
          if (!o) return
          if (o.error) onError?.(o.error)
          else await onSuccess?.(o.result)
        }}
      >
        {label}
      </button>
    </div>
  ),
}))

const SECRET = 'Adm1n-Secret!'

function Where() {
  const loc = useLocation()
  return <div data-testid="where">{loc.pathname + loc.search}</div>
}

function renderAt(url) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/login" element={<LoginChooser />} />
        <Route path="/login/:portal" element={<PortalLogin />} />
        <Route path="/register" element={<AuthPage />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )
}

function passwordField(prefix = 'admin') {
  return document.getElementById(`${prefix}-password`)
}

describe('sign-in screens', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('az')
    useUiStore.setState({ theme: 'light' })
    useAuthStore.setState({ user: null, token: null })
    vi.mocked(api.post).mockReset()
    vi.mocked(api.get).mockReset()
    vi.mocked(api.get).mockResolvedValue({ password_login: false })
    googleOutcome.value = null
  })

  describe('/login — Giriş seçimi', () => {
    it('offers the four portals, each linking to its own page', () => {
      renderAt('/login')
      expect(screen.getByRole('heading', { name: 'Giriş seçimi' })).toBeInTheDocument()
      expect(screen.getByTestId('portal-choice-student')).toHaveAttribute('href', '/login/student')
      expect(screen.getByTestId('portal-choice-instructor')).toHaveAttribute('href', '/login/instructor')
      expect(screen.getByTestId('portal-choice-organization')).toHaveAttribute('href', '/login/organization')
      expect(screen.getByTestId('portal-choice-admin')).toHaveAttribute('href', '/login/admin')
      expect(passwordField()).toBeNull()
    })

    it('carries ?next= to the chosen portal', () => {
      renderAt('/login?next=%2Fstudent%2Fexams')
      expect(screen.getByTestId('portal-choice-student')).toHaveAttribute('href', '/login/student?next=%2Fstudent%2Fexams')
    })

    it.each(['/login?admin=true', '/login?next=%2Fadmin%2Fusers'])('old admin link %s opens /login/admin', async (url) => {
      renderAt(url)
      expect(await screen.findByRole('heading', { name: 'Admin panelinə giriş' })).toBeInTheDocument()
    })
  })

  describe.each([
    ['student', 'Tələbə kabinetinə giriş'],
    ['instructor', 'Təlimçi kabinetinə giriş'],
    ['organization', 'Təşkilat kabinetinə giriş'],
    ['admin', 'Admin panelinə giriş'],
  ])('/login/%s', (portal, title) => {
    it('has its own title and the existing Google button with the portal id', () => {
      renderAt(`/login/${portal}`)
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Google ilə davam et' })).toHaveAttribute('data-portal', portal)
    })
  })

  it('unknown portal falls back to the chooser', () => {
    renderAt('/login/superuser')
    expect(screen.getByRole('heading', { name: 'Giriş seçimi' })).toBeInTheDocument()
  })

  describe('email/password form', () => {
    it('is hidden on user portals while password login is switched off', async () => {
      renderAt('/login/student')
      await screen.findByRole('heading', { name: 'Tələbə kabinetinə giriş' })
      expect(passwordField('student')).toBeNull()
    })

    it('appears on user portals when the server enables it, and sends the portal id', async () => {
      vi.mocked(api.get).mockResolvedValue({ password_login: true })
      vi.mocked(api.post).mockResolvedValue({ token: 't', user: { id: 1, role: 'student' }, redirect: '/student' })
      const user = userEvent.setup()
      renderAt('/login/student')
      const pw = await screen.findByLabelText('Şifrə')
      await user.type(screen.getByLabelText('E-poçt'), 'aysel@x.az')
      await user.type(pw, SECRET)
      await user.click(screen.getByRole('button', { name: 'Daxil ol' }))
      expect(api.post).toHaveBeenCalledWith('/auth/login/email', { email: 'aysel@x.az', password: SECRET, portal: 'student' })
      expect(await screen.findByTestId('where')).toHaveTextContent('/student')
      expect(useAuthStore.getState().token).toBe('t')
    })

    it('admin page always shows the admin password form', () => {
      renderAt('/login/admin')
      expect(passwordField()).toHaveAttribute('type', 'password')
      expect(passwordField()).toHaveAttribute('autocomplete', 'current-password')
      expect(screen.getByLabelText('Telefon və ya email')).toHaveAttribute('autocomplete', 'username')
    })
  })

  describe('admin form (unchanged behaviour)', () => {
    it('admin notice is neutral (not error-red) and describes the form', () => {
      renderAt('/login/admin')
      const notice = screen.getByText(/Şifrə ilə giriş yalnız idarəçi hesabları üçündür/)
      expect(notice.className).not.toMatch(/red/)
      expect(notice).not.toHaveAttribute('role', 'alert')
      expect(notice.closest('form')).toHaveAttribute('aria-describedby', notice.id)
    })

    it('no forgot-password link and no phone/SMS/OTP UI', () => {
      const { container } = renderAt('/login/admin')
      expect(screen.queryByRole('link', { name: /unut/i })).toBeNull()
      expect(container.textContent).not.toMatch(/SMS|OTP|WhatsApp/i)
      expect(container.querySelector('input[autocomplete="one-time-code"]')).toBeNull()
    })

    it('toggling visibility never submits the login form', async () => {
      const user = userEvent.setup()
      renderAt('/login/admin')
      await user.type(passwordField(), SECRET)
      await user.click(screen.getByRole('button', { name: 'Şifrəni göstər' }))
      expect(passwordField()).toHaveAttribute('type', 'text')
      expect(api.post).not.toHaveBeenCalled()
    })

    it('rejects an invalid identifier with an accessible inline error and no request', async () => {
      const user = userEvent.setup()
      renderAt('/login/admin')
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

    it.each(['admin@edupanel.co', '+994 50 123 45 67'])('submits %s to /auth/login with the admin portal and opens /admin', async (value) => {
      vi.mocked(api.post).mockResolvedValue({ token: 't', user: { id: 1, role: 'admin' } })
      const user = userEvent.setup()
      renderAt('/login/admin')
      await user.type(screen.getByLabelText('Telefon və ya email'), value)
      await user.type(passwordField(), SECRET)
      await user.click(screen.getByRole('button', { name: 'Daxil ol' }))
      expect(api.post).toHaveBeenCalledWith('/auth/login', { identifier: value, password: SECRET, portal: 'admin' })
      expect(await screen.findByTestId('where')).toHaveTextContent('/admin')
    })

    it('shows a server login error as an alert linked to the password field, without logging the password', async () => {
      const spies = ['log', 'info', 'warn', 'error', 'debug'].map((m) => vi.spyOn(console, m))
      vi.mocked(api.post).mockRejectedValue(new Error('Giriş məlumatları yanlışdır'))
      const user = userEvent.setup()
      renderAt('/login/admin')
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

    it('has no nested interactive elements and renders in dark mode', () => {
      useUiStore.setState({ theme: 'dark' })
      const { container } = renderAt('/login/admin')
      for (const el of container.querySelectorAll('a, button, input, select, textarea')) {
        expect(el.parentElement.closest('a, button')).toBeNull()
      }
      const form = passwordField().closest('form')
      expect(within(form).getByRole('button', { name: 'Şifrəni göstər' }).className).toContain('text-gray-300')
    })
  })

  describe('server decides the cabinet', () => {
    it('Google sign-in with the role → session + cabinet from the server', async () => {
      googleOutcome.value = { result: { token: 'g', user: { id: 2, role: 'instructor' }, redirect: '/instructor' } }
      const user = userEvent.setup()
      renderAt('/login/instructor')
      await user.click(screen.getByRole('button', { name: 'Google ilə davam et' }))
      expect(await screen.findByTestId('where')).toHaveTextContent('/instructor')
      expect(useAuthStore.getState().user.role).toBe('instructor')
    })

    it('a safe ?next inside the same cabinet is kept; other cabinets are ignored', async () => {
      googleOutcome.value = { result: { token: 'g', user: { id: 2, role: 'student' }, redirect: '/student' } }
      const user = userEvent.setup()
      const first = renderAt('/login/student?next=%2Fstudent%2Fexams')
      await user.click(screen.getByRole('button', { name: 'Google ilə davam et' }))
      expect(await screen.findByTestId('where')).toHaveTextContent('/student/exams')
      first.unmount()
      renderAt('/login/student?next=%2Fadmin')
      await user.click(screen.getByRole('button', { name: 'Google ilə davam et' }))
      expect(await screen.findByTestId('where')).toHaveTextContent(/^\/student$/)
    })

    it.each([
      ['student', 'Bu hesabda tələbə girişi üçün icazə yoxdur.'],
      ['instructor', 'Bu hesabda təlimçi girişi üçün icazə yoxdur.'],
      ['organization', 'Bu hesabda təşkilat girişi üçün icazə yoxdur.'],
      ['admin', 'Bu hesabda admin girişi üçün icazə yoxdur.'],
    ])('403 on %s: shows the message, no session, no cabinet', async (portal, message) => {
      googleOutcome.value = { error: { code: 'PORTAL_ROLE_REQUIRED', status: 403, message, can_register: portal !== 'admin' } }
      const user = userEvent.setup()
      renderAt(`/login/${portal}`)
      await user.click(screen.getByRole('button', { name: 'Google ilə davam et' }))
      const alert = await screen.findByTestId('portal-denied')
      expect(alert).toHaveTextContent(message)
      expect(useAuthStore.getState().token).toBeNull()
      expect(screen.queryByTestId('where')).toBeNull()
      expect(within(alert).getByRole('link', { name: 'Başqa giriş seçimi' })).toHaveAttribute('href', '/login')
      if (portal !== 'admin') expect(within(alert).getByRole('link', { name: 'Hesab yarat' })).toHaveAttribute('href', '/register')
    })
  })

  it('/register keeps the Google sign-up only', () => {
    renderAt('/register')
    expect(screen.getByRole('button', { name: 'Google ilə davam et' })).toBeInTheDocument()
    expect(passwordField()).toBeNull()
  })
})
