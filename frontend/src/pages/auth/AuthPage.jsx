import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import useAuthStore from '../../hooks/useAuth'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'
import InstructorEmailAuth from '../../components/auth/InstructorEmailAuth'
import Brand from '../../components/common/Brand'
import { setPageSeo } from '../../lib/pageSeo'
import { postAuthNavigate } from '../../lib/postAuth'

/** Tam səhifə giriş / qeydiyyat (/login, /register) */
export default function AuthPage() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const isAdmin = searchParams.get('admin') === 'true'
  const initialTab = useMemo(
    () => (location.pathname === '/register' ? 'signup' : 'login'),
    [location.pathname],
  )

  const [authTab, setAuthTab] = useState(initialTab)

  useEffect(() => {
    setAuthTab(initialTab)
  }, [initialTab])

  useEffect(() => {
    const next = String(searchParams.get('next') || '').trim()
    if (next.startsWith('/') && next !== '/login' && next !== '/register') {
      try {
        sessionStorage.setItem('mx_return_after_login', next)
      } catch {
        /* ignore */
      }
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
      toast(err.message || 'Giriş xətası', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const isRegister = location.pathname === '/register'
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
  }, [isAdmin, location.pathname])

  const authGreeting = authTab === 'signup' ? 'Hesab yaradın' : 'Xoş gəldiniz'

  return (
    <div className="login-wrapper flex min-h-[100svh] w-full min-w-0 max-w-full flex-col overflow-x-hidden">
      <header className="shrink-0 w-full max-w-sm mx-auto px-4 pt-4 sm:pt-6 pb-3 sm:pb-4">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-xs sm:text-sm font-medium text-gray-400 hover:text-white transition-colors"
        >
          ← Ana səhifəyə qayıt
        </Link>
      </header>
      <main className="flex flex-1 items-start sm:items-center justify-center px-4 pb-8 sm:pb-10 min-h-0 overflow-y-auto">
      <div id="mx-login" className="w-full max-w-sm scroll-mt-6">
        <div className="mx-login-card rounded-2xl border border-white/20 bg-surface-2 p-5 sm:p-6">
          {!isAdmin ? (
            <div className="mb-3 text-center space-y-2">
              <div className="flex justify-center">
                <Brand size="login" />
              </div>
              <div className="h-0.5 w-10 mx-auto rounded-full bg-primary" aria-hidden />
              <h1 className="text-sm font-semibold text-gray-200">{authGreeting}</h1>
            </div>
          ) : (
            <div className="text-center mb-6 sm:mb-8">
              <div className="flex justify-center pt-1 pb-2 bg-transparent">
                <Brand size="login" />
              </div>
              <div className="h-0.5 w-10 mx-auto rounded-full bg-primary mb-3" aria-hidden />
              <div className="text-gray-400 text-sm">Hesabınıza daxil olun</div>
            </div>
          )}

          {isAdmin ? (
            <form onSubmit={handleEmailLogin} className="space-y-4" autoComplete="on">
              <div className="text-center text-red-400 text-xs py-2 px-3 bg-red-500/10 border border-red-500/20 rounded-xl mb-4">
                Admin panel
              </div>
              <div>
                <label
                  className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2"
                  htmlFor="admin-username"
                >
                  Telefon və ya email
                </label>
                <input
                  id="admin-username"
                  name="username"
                  className="mx-auth-input w-full bg-surface-1 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none"
                  type="text"
                  inputMode="email"
                  autoComplete="username"
                  placeholder="+994XXXXXXXXX və ya admin email"
                  value={adminIdentifier}
                  onChange={(e) => setAdminIdentifier(e.target.value)}
                  required
                />
              </div>
              <div>
                <label
                  className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2"
                  htmlFor="admin-password"
                >
                  Şifrə
                </label>
                <input
                  id="admin-password"
                  name="password"
                  className="mx-auth-input w-full bg-surface-1 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" loading={loading} className="w-full justify-center py-3">
                Daxil ol
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
