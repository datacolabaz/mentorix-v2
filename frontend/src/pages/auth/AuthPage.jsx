import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import useAuthStore from '../../hooks/useAuth'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'
import InstructorEmailAuth from '../../components/auth/InstructorEmailAuth'
import Brand from '../../components/common/Brand'
import LocaleThemeBar from '../../components/LocaleThemeBar'
import { setPageSeo } from '../../lib/pageSeo'
import { postAuthNavigate, rememberReturnAfterLogin } from '../../lib/postAuth'
import useUiStore from '../../hooks/useUi'

/** Tam səhifə giriş / qeydiyyat (/login, /register) */
export default function AuthPage() {
  const { t } = useTranslation()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const isAdmin = searchParams.get('admin') === 'true'
  const tabParam = searchParams.get('tab')
  const initialTab = useMemo(
    () => (location.pathname === '/register' || tabParam === 'signup' ? 'signup' : 'login'),
    [location.pathname, tabParam],
  )

  const [authTab, setAuthTab] = useState(initialTab)
  const { theme } = useUiStore()
  const isDark = theme === 'dark'
  const tone = isDark ? 'dark' : 'light'

  useEffect(() => {
    setAuthTab(initialTab)
  }, [initialTab])

  useEffect(() => {
    const next = String(searchParams.get('next') || '').trim()
    if (next.startsWith('/') && next !== '/login' && next !== '/register') {
      rememberReturnAfterLogin(next)
    }
  }, [searchParams])

  const [adminIdentifier, setAdminIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const { login } = useAuthStore()
  const navigate = useNavigate()
  const toast = useToast()

  const goDashboard = (roleOrUser) => {
    const u =
      roleOrUser && typeof roleOrUser === 'object'
        ? roleOrUser
        : useAuthStore.getState().user || { role: roleOrUser }
    postAuthNavigate(u, navigate)
  }

  const handleEmailLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const user = await login(adminIdentifier, password)
      goDashboard(user.role)
    } catch (err) {
      toast(err.message || t('auth.loginError'), 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const isRegister = location.pathname === '/register' || tabParam === 'signup'
    setPageSeo({
      title: isAdmin ? 'Mentorix — admin girişi' : isRegister ? 'Mentorix — qeydiyyat' : 'Mentorix — giriş',
      description: isAdmin
        ? 'Mentorix admin panelinə daxil olun.'
        : isRegister
          ? 'Mentorix-də pulsuz hesab yaradın.'
          : 'Mentorix hesabınıza daxil olun.',
      canonicalPath: isAdmin ? '/login?admin=true' : isRegister ? '/register' : '/login',
      breadcrumbs: isAdmin
        ? [
            { name: 'Mentorix', path: '/' },
            { name: 'Admin girişi', path: '/login' },
          ]
        : [
            { name: 'Mentorix', path: '/' },
            { name: isRegister ? 'Qeydiyyat' : 'Giriş', path: isRegister ? '/register' : '/login' },
          ],
    })
  }, [isAdmin, location.pathname, tabParam])

  const authGreeting = authTab === 'signup' ? t('auth.createAccount') : t('auth.welcome')

  return (
    <div
      className={[
        'login-wrapper flex min-h-[100svh] w-full min-w-0 max-w-full flex-col overflow-x-hidden',
        isDark ? 'theme-dark' : 'theme-light',
      ].join(' ')}
    >
      <header className="relative z-[30] shrink-0 w-full px-4 py-3 sm:pt-6 sm:pb-4">
        <div className="flex w-full items-center justify-between gap-2 sm:gap-3">
          <Link
            to="/"
            className={[
              'inline-flex items-center gap-1 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap min-w-0',
              isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900',
            ].join(' ')}
          >
            {t('auth.backHome')}
          </Link>
          <LocaleThemeBar tone={tone} />
        </div>
      </header>
      <main className="flex flex-1 items-start sm:items-center justify-center px-4 pb-8 sm:pb-10 min-h-0 overflow-y-auto">
      <div id="mx-login" className="w-full max-w-sm scroll-mt-6">
        <div
          className={[
            'mx-login-card rounded-2xl border p-5 sm:p-6',
            isDark ? 'border-white/20 bg-surface-2' : 'border-slate-200 bg-white shadow-sm',
          ].join(' ')}
        >
          {!isAdmin ? (
            <div className="mb-3 text-center space-y-2">
              <div className="flex justify-center">
                <Brand size="login" tone={tone === 'dark' ? 'dark' : 'light'} />
              </div>
              <div className="h-0.5 w-10 mx-auto rounded-full bg-primary" aria-hidden />
              <h1 className={['text-sm font-semibold', isDark ? 'text-gray-200' : 'text-slate-800'].join(' ')}>
                {authGreeting}
              </h1>
            </div>
          ) : (
            <div className="text-center mb-6 sm:mb-8">
              <div className="flex justify-center pt-1 pb-2 bg-transparent">
                <Brand size="login" tone={tone === 'dark' ? 'dark' : 'light'} />
              </div>
              <div className="h-0.5 w-10 mx-auto rounded-full bg-primary mb-3" aria-hidden />
              <div className={['text-sm', isDark ? 'text-gray-400' : 'text-slate-500'].join(' ')}>
                {t('auth.loginToAccount')}
              </div>
            </div>
          )}

          {isAdmin ? (
            <form onSubmit={handleEmailLogin} className="space-y-4" autoComplete="on">
              <div
                className={[
                  'text-center text-xs py-2 px-3 rounded-xl mb-4 border',
                  isDark
                    ? 'text-red-400 bg-red-500/10 border-red-500/20'
                    : 'text-red-700 bg-red-50 border-red-200',
                ].join(' ')}
              >
                {t('auth.adminPanel')}
              </div>
              <div>
                <label
                  className={[
                    'block text-xs font-semibold uppercase tracking-wider mb-2',
                    isDark ? 'text-gray-400' : 'text-slate-500',
                  ].join(' ')}
                  htmlFor="admin-username"
                >
                  {t('auth.phoneOrEmail')}
                </label>
                <input
                  id="admin-username"
                  name="username"
                  className={[
                    'mx-auth-input w-full rounded-xl px-4 py-3 text-sm outline-none border',
                    isDark
                      ? 'bg-surface-1 border-white/10 text-white placeholder:text-gray-500'
                      : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400',
                  ].join(' ')}
                  type="text"
                  inputMode="email"
                  autoComplete="username"
                  placeholder={t('auth.phoneOrEmail')}
                  value={adminIdentifier}
                  onChange={(e) => setAdminIdentifier(e.target.value)}
                  required
                />
              </div>
              <div>
                <label
                  className={[
                    'block text-xs font-semibold uppercase tracking-wider mb-2',
                    isDark ? 'text-gray-400' : 'text-slate-500',
                  ].join(' ')}
                  htmlFor="admin-password"
                >
                  {t('auth.password')}
                </label>
                <input
                  id="admin-password"
                  name="password"
                  className={[
                    'mx-auth-input w-full rounded-xl px-4 py-3 text-sm outline-none border',
                    isDark
                      ? 'bg-surface-1 border-white/10 text-white placeholder:text-gray-500'
                      : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400',
                  ].join(' ')}
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" loading={loading} className="w-full justify-center py-3">
                {t('auth.login')}
              </Button>
            </form>
          ) : (
            <InstructorEmailAuth
              key={initialTab}
              initialTab={initialTab}
              onSuccess={(u) => goDashboard(u)}
              onTabChange={setAuthTab}
            />
          )}
        </div>
      </div>
      </main>
    </div>
  )
}

