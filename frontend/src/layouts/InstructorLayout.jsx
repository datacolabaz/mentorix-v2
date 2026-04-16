import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import useAuthStore from '../hooks/useAuth'
import useUiStore from '../hooks/useUi'
import api from '../lib/api'

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
  const { user, logout } = useAuthStore()
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
    <div className="flex h-screen bg-[#0f0c29] text-white overflow-hidden">
      {focusMode && (
        <button
          type="button"
          aria-label="Menyunu aç"
          className="fixed top-3 left-3 z-[260] w-11 h-11 rounded-xl bg-[#13112e] border border-indigo-500/30 text-lg flex items-center justify-center shadow-lg"
          onClick={() => setNavOpen(true)}
        >
          ☰
        </button>
      )}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-[60] flex items-center justify-between gap-2 px-3 py-3 bg-[#13112e] border-b border-indigo-500/20">
        <button
          type="button"
          aria-label="Menyu"
          className="p-2 rounded-xl text-white bg-white/10 hover:bg-white/15 shrink-0"
          onClick={() => setNavOpen(true)}
        >
          ☰
        </button>
        <div className="font-display font-extrabold text-sm sm:text-base bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent truncate min-w-0">
          edupanel <span className="text-gray-500 text-xs font-normal">.co</span>
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
          'w-[min(17rem,88vw)] max-w-[280px] bg-[#13112e] border-r border-indigo-500/20 flex flex-col flex-shrink-0',
          'fixed lg:static inset-y-0 left-0 z-[80] transition-transform duration-200 ease-out',
          navOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          focusMode ? 'lg:-translate-x-full' : '',
        ].join(' ')}
      >
        <div className="p-5 border-b border-indigo-500/20 hidden lg:block">
          <div className="font-display font-extrabold text-xl bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            edupanel <span className="text-gray-500 text-xs font-normal">.co</span>
          </div>
          <div className="mt-3 p-3 bg-[#1a1740] rounded-xl border border-indigo-500/20">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center text-sm font-bold mb-2">
              {user?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
            <div className="text-sm font-semibold break-words">{user?.full_name}</div>
            <div className="text-xs text-gray-400">Müəllim</div>
          </div>
        </div>

        <div className="lg:hidden p-4 border-b border-indigo-500/20 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{user?.full_name}</div>
            <div className="text-xs text-gray-400">Müəllim</div>
          </div>
          <button
            type="button"
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 shrink-0 text-lg leading-none"
            onClick={() => setNavOpen(false)}
            aria-label="Bağla"
          >
            ×
          </button>
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
                  isActive ? 'bg-blue-500/20 text-blue-300 border border-blue-500/20'
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

        <div className="p-4 border-t border-indigo-500/20">
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

      <main className="flex-1 overflow-y-auto min-w-0 pt-[52px] lg:pt-0">
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
        <Outlet />
      </main>
    </div>
  )
}
