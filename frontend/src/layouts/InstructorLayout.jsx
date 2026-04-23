import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import useAuthStore from '../hooks/useAuth'
import useUiStore from '../hooks/useUi'
import api from '../lib/api'
import { instructorRoleAz } from '../lib/instructorLabel'
import Brand from '../components/common/Brand'
import BrandSvg from '../components/common/BrandSvg'
import Footer from '../components/common/Footer'
import { sidebarNavClass } from '../lib/sidebarNavClass'
import NavIcon from '../components/common/NavIcon'

const NAV = [
  { to: '/instructor', label: 'Dashboard', icon: <NavIcon name="dashboard" />, end: true },
  { to: '/instructor/students', label: 'Tələbələrim', icon: <NavIcon name="students" /> },
  { to: '/instructor/schedule', label: 'Cədvəlim', icon: <NavIcon name="schedule" /> },
  { to: '/instructor/attendance', label: 'Davamiyyət', icon: <NavIcon name="attendance" /> },
  { to: '/instructor/exams', label: 'İmtahanlar', icon: <NavIcon name="exams" /> },
  { to: '/instructor/tasks', label: 'Tapşırıqlar', icon: <NavIcon name="tasks" /> },
  { to: '/instructor/analytics', label: 'Analitika', icon: <NavIcon name="analytics" /> },
  { to: '/instructor/payments', label: 'Ödənişlər', icon: <NavIcon name="payments" /> },
  { to: '/instructor/notifications', label: 'Bildirişlər', icon: <NavIcon name="notifications" /> },
  { to: '/instructor/settings', label: 'Tənzimləmələr', icon: <NavIcon name="settings" /> },
]

export default function InstructorLayout() {
  const { user, logout, updateUser } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [navOpen, setNavOpen] = useState(false)
  const { focusMode, setFocusMode, theme, toggleTheme } = useUiStore()
  const [limitStatus, setLimitStatus] = useState({ level: null, message: null })

  useEffect(() => {
    setNavOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (focusMode) setNavOpen(false)
  }, [focusMode])

  useEffect(() => {
    let cancelled = false
    api
      .get('/auth/me')
      .then((d) => {
        if (cancelled || !d?.user) return
        updateUser(d.user)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [updateUser])

  useEffect(() => {
    let cancelled = false
    api
      .get('/notifications/instructor')
      .then((d) => {
        if (cancelled) return
        const alerts = d.alerts || []
        const critical = alerts.find((a) => a.level === 'critical')
        const warning = alerts.find((a) => a.level === 'warning')
        if (critical) setLimitStatus({ level: 'critical', message: critical.message })
        else if (warning) setLimitStatus({ level: 'warning', message: warning.message })
        else setLimitStatus({ level: null, message: null })
      })
      .catch(() => {
        if (!cancelled) setLimitStatus({ level: null, message: null })
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className={`theme-${theme} flex h-screen bg-token-surfaceMain text-token-textMain overflow-hidden`}>
      {focusMode && (
        <button
          type="button"
          aria-label="Menyunu aç"
          className="fixed top-4 left-4 z-[260] w-12 h-12 rounded-2xl bg-surface-2 border border-white/10 text-xl flex items-center justify-center shadow-lg"
          onClick={() => setNavOpen(true)}
        >
          ☰
        </button>
      )}
      <header
        className={[
          'lg:hidden fixed top-0 left-0 right-0 z-[1000] h-[72px] flex items-center justify-between gap-2 px-3 overflow-visible',
          theme === 'dark'
            ? 'bg-token-surfaceMain border-b border-[rgb(var(--border-subtle))] text-token-textMain'
            : 'bg-token-surfaceMain border-b border-[rgb(var(--border-subtle))] text-token-textMain',
        ].join(' ')}
      >
        <button
          type="button"
          aria-label="Menyu"
          className={[
            'w-11 h-11 rounded-2xl shrink-0 flex items-center justify-center text-xl border',
            theme === 'dark'
              ? 'text-white bg-white/5 hover:bg-white/10 border-white/10'
              : 'text-[#003366] bg-gray-100 hover:bg-gray-200 border-gray-200',
          ].join(' ')}
          onClick={() => setNavOpen(true)}
        >
          ☰
        </button>
        <div className="flex-1 flex justify-center min-w-0 overflow-visible">
          {theme === 'dark' ? <BrandSvg size="md" className="text-white" /> : <Brand size="md" />}
        </div>
        <div className="w-11 shrink-0" />
      </header>

      {navOpen && (
        <button
          type="button"
          aria-label="Menyunu bağla"
          className="lg:hidden fixed inset-0 z-[70] bg-black/60"
          onClick={() => setNavOpen(false)}
        />
      )}

      <aside
        className={[
          theme === 'dark' ? 'theme-dark' : 'theme-light',
          'w-[min(17rem,88vw)] max-w-[280px] flex flex-col flex-shrink-0',
          theme === 'dark'
            ? 'bg-token-surfaceMain border-r border-[rgb(var(--border-subtle))]'
            : 'bg-token-surfaceMain border-r border-[rgb(var(--border-subtle))]',
          'fixed lg:static inset-y-0 left-0 z-[80] transition-transform duration-200 ease-out',
          navOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          focusMode ? 'lg:-translate-x-full' : '',
        ].join(' ')}
      >
        <div
          className={[
            'px-4 pt-4 pb-4 hidden lg:block',
            theme === 'dark' ? 'border-b border-white/10' : 'border-b border-gray-200',
          ].join(' ')}
        >
          <div className="flex justify-center">
            {theme === 'dark' ? (
              <BrandSvg size="sidebar" className="text-white" />
            ) : (
              <Brand size="sidebar" />
            )}
          </div>
          <div
            className={[
              'mt-4 p-3 rounded-xl border',
              theme === 'dark'
                ? 'bg-token-surfaceCard/55 border-[rgb(var(--border-subtle))]'
                : 'bg-token-surfaceCard/70 border-[rgb(var(--border-subtle))]',
            ].join(' ')}
          >
            <div
              className={[
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mb-2 border',
                theme === 'dark'
                  ? 'bg-white/5 border-white/10 text-white'
                  : 'bg-[#003366]/10 border-[#003366]/20 text-[#003366]',
              ].join(' ')}
            >
              {user?.full_name?.split(' ').map((n) => n[0]).join('').slice(0, 2)}
            </div>
            <div className={`text-sm font-semibold break-words ${theme === 'dark' ? 'text-white' : 'text-[#0f172a]'}`}>
              {user?.full_name}
            </div>
            <div className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              {instructorRoleAz(user?.public_label)}
            </div>
          </div>
        </div>

        <div
          className={[
            'lg:hidden px-4 pt-4 pb-4',
            'border-b border-[rgb(var(--border-subtle))]',
          ].join(' ')}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0 flex justify-center">
              {theme === 'dark' ? (
                <BrandSvg size="sidebar" className="text-white" />
              ) : (
                <Brand size="sidebar" />
              )}
            </div>
            <button
              type="button"
              className={[
                'p-2 rounded-xl shrink-0 text-lg leading-none',
                theme === 'dark' ? 'text-gray-300 hover:bg-white/5' : 'text-gray-600 hover:bg-gray-100',
              ].join(' ')}
              onClick={() => setNavOpen(false)}
              aria-label="Bağla"
            >
              ×
            </button>
          </div>
          <div className="mt-4 min-w-0">
            <div className={`text-sm font-semibold truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {user?.full_name}
            </div>
            <div className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              {instructorRoleAz(user?.public_label)}
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setNavOpen(false)}
              className={({ isActive }) => sidebarNavClass(isActive, theme)}
            >
              <span className="shrink-0 relative">
                {item.icon}
                {item.to === '/instructor/notifications' && limitStatus.level ? (
                  <span
                    className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-gray-400"
                  />
                ) : null}
              </span>
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-[rgb(var(--border-subtle))]">
          <button
            type="button"
            onClick={toggleTheme}
            className={[
              'w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-colors',
              theme === 'dark'
                ? 'border-[rgb(var(--border-subtle))] bg-token-surfaceCard/45 hover:bg-token-surfaceCard/60'
                : 'border-[rgb(var(--border-subtle))] bg-token-surfaceCard/70 hover:bg-token-surfaceCard/90',
            ].join(' ')}
          >
            <span className="text-sm font-medium text-token-textMain">
              Tema
            </span>
            <span className="flex items-center gap-2">
              <span className="text-xs text-token-textMuted">
                {theme === 'dark' ? 'Gecə' : 'Gündüz'}
              </span>
              <span
                aria-hidden
                className={[
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  theme === 'dark' ? 'bg-primary/40' : 'bg-gray-300',
                ].join(' ')}
              >
                <span
                  className={[
                    'inline-block h-5 w-5 transform rounded-full bg-white transition-transform',
                    theme === 'dark' ? 'translate-x-5' : 'translate-x-1',
                  ].join(' ')}
                />
              </span>
            </span>
          </button>

          <button
            onClick={() => {
              setFocusMode(false)
              logout()
              navigate('/login')
            }}
            className={[
              'mt-3 flex items-center gap-2 text-sm font-medium transition-colors w-full px-4 py-3 rounded-xl',
              theme === 'dark'
                ? 'text-red-300 hover:text-red-200 hover:bg-red-500/10'
                : 'text-red-600 hover:text-red-700 hover:bg-red-50',
            ].join(' ')}
          >
            → Çıxış
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto min-w-0 pt-[72px] lg:pt-0">
        <div className="min-h-full flex flex-col">
          {limitStatus.level ? (
            <div
              className={`mx-4 sm:mx-6 mt-4 rounded-2xl border px-4 py-3 text-sm ${
                limitStatus.level === 'critical'
                  ? 'border-red-500/40 bg-red-500/10 text-red-200'
                  : 'border-yellow-500/40 bg-yellow-500/10 text-yellow-200'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold">
                    {limitStatus.level === 'critical' ? 'Limit dolub' : 'Diqqət'}
                  </div>
                  <div className="text-white/80 break-words">{limitStatus.message}</div>
                </div>
                <button
                  onClick={() => setLimitStatus({ level: null, message: null })}
                  className="shrink-0 text-white/70 hover:text-white transition-colors"
                  aria-label="Bağla"
                >
                  ×
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex-1 min-h-0">
            <Outlet />
          </div>

          <Footer />
        </div>
      </main>
    </div>
  )
}
