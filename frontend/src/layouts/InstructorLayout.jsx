import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import useAuthStore from '../hooks/useAuth'
import useUiStore from '../hooks/useUi'
import api from '../lib/api'
import { instructorRoleAz } from '../lib/instructorLabel'
import Brand from '../components/common/Brand'
import Footer from '../components/common/Footer'

const NAV = [
  { to: '/instructor', label: 'Dashboard', icon: '📊', end: true },
  { to: '/instructor/students', label: 'Tələbələrim', icon: '🎓' },
  { to: '/instructor/schedule', label: 'Cədvəlim', icon: '📅' },
  { to: '/instructor/attendance', label: 'Davamiyyət', icon: '✅' },
  { to: '/instructor/exams', label: 'İmtahanlar', icon: '📝' },
  { to: '/instructor/tasks', label: 'Tapşırıqlar', icon: '📋' },
  { to: '/instructor/analytics', label: 'Analitika', icon: '📈' },
  { to: '/instructor/payments', label: 'Ödənişlər', icon: '💳' },
  { to: '/instructor/notifications', label: 'Bildirişlər', icon: '🔔' },
  { to: '/instructor/settings', label: 'Tənzimləmələr', icon: '⚙️' },
]

export default function InstructorLayout() {
  const { user, logout, updateUser } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [navOpen, setNavOpen] = useState(false)
  const { focusMode, setFocusMode } = useUiStore()
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
    <div className="flex h-screen bg-[#0b0b0b] text-white overflow-hidden">
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
      <header className="lg:hidden fixed top-0 left-0 right-0 z-[1000] h-[64px] flex items-center justify-between gap-3 px-4 bg-surface-2/95 border-b border-white/10 backdrop-blur">
        <button
          type="button"
          aria-label="Menyu"
          className="w-12 h-12 rounded-2xl text-white bg-white/10 hover:bg-white/15 shrink-0 flex items-center justify-center text-xl"
          onClick={() => setNavOpen(true)}
        >
          ☰
        </button>
        <div className="flex-1 flex justify-center min-w-0">
          <Brand size="sidebar" imgClassName="scale-[1.05]" />
        </div>
        <div className="w-10 shrink-0" />
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
          'w-[min(17rem,88vw)] max-w-[280px] bg-surface-2 border-r border-white/10 flex flex-col flex-shrink-0',
          'fixed lg:static inset-y-0 left-0 z-[80] transition-transform duration-200 ease-out',
          navOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          focusMode ? 'lg:-translate-x-full' : '',
        ].join(' ')}
      >
        <div className="px-3 py-3 border-b border-white/10 hidden lg:block">
          <div className="w-full flex items-center justify-center">
            <Brand size="sidebar" imgClassName="scale-[1.45] -my-1" />
          </div>
          <div className="mt-3 p-3 bg-surface-1 rounded-xl border border-white/10">
            <div className="w-8 h-8 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-sm font-bold mb-2">
              {user?.full_name?.split(' ').map((n) => n[0]).join('').slice(0, 2)}
            </div>
            <div className="text-sm font-semibold break-words">{user?.full_name}</div>
            <div className="text-xs text-gray-300">{instructorRoleAz(user?.public_label)}</div>
          </div>
        </div>

        <div className="lg:hidden px-3 py-3 border-b border-white/10">
          <div className="flex items-center justify-between gap-2">
            <Brand size="sidebar" imgClassName="scale-[1.3] -my-1" />
            <button
              type="button"
              className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 shrink-0 text-lg leading-none"
              onClick={() => setNavOpen(false)}
              aria-label="Bağla"
            >
              ×
            </button>
          </div>
          <div className="mt-3 min-w-0">
            <div className="text-sm font-semibold truncate">{user?.full_name}</div>
            <div className="text-xs text-gray-300">{instructorRoleAz(user?.public_label)}</div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setNavOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
            >
              <span className="shrink-0 relative">
                {item.icon}
                {item.to === '/instructor/notifications' && limitStatus.level ? (
                  <span
                    className={`absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full ${
                      limitStatus.level === 'critical' ? 'bg-red-500' : 'bg-yellow-500'
                    }`}
                  />
                ) : null}
              </span>
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <button
            onClick={() => {
              setFocusMode(false)
              logout()
              navigate('/login')
            }}
            className="flex items-center gap-2 text-red-400 text-sm font-medium hover:text-red-300 transition-colors w-full px-3 py-2 rounded-xl hover:bg-red-500/10"
          >
            → Çıxış
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto min-w-0 pt-[64px] lg:pt-0">
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
