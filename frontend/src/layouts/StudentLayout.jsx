import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import useAuthStore from '../hooks/useAuth'
import useUiStore from '../hooks/useUi'
import Brand from '../components/common/Brand'
import Footer from '../components/common/Footer'

const NAV = [
  { to: '/student', label: 'Proqresim', icon: '📈', end: true },
  { to: '/student/schedule', label: 'Cədvəlim', icon: '📅' },
  { to: '/student/exams', label: 'İmtahanlarım', icon: '📝' },
  { to: '/student/assignments', label: 'Tapşırıqlarım', icon: '📋' },
  { to: '/student/payments', label: 'Ödəniş', icon: '💳' },
  { to: '/student/notifications', label: 'Bildirişlər', icon: '🔔' },
]

export default function StudentLayout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [navOpen, setNavOpen] = useState(false)
  const { focusMode, setFocusMode } = useUiStore()

  const closeNav = () => setNavOpen(false)

  useEffect(() => {
    if (focusMode) setNavOpen(false)
  }, [focusMode])

  return (
    <div className="flex h-screen bg-[#0b0b0b] text-white overflow-hidden">
      <button
        type="button"
        onClick={() => setNavOpen(true)}
        className="md:hidden fixed top-3 left-3 z-50 w-11 h-11 rounded-xl bg-surface-2 border border-white/10 text-lg flex items-center justify-center shadow-lg"
        aria-label="Menyunu aç"
      >
        ☰
      </button>

      {focusMode && (
        <button
          type="button"
          onClick={() => setNavOpen(true)}
          className="hidden md:flex fixed top-3 left-3 z-[260] w-11 h-11 rounded-xl bg-surface-2 border border-white/10 text-lg items-center justify-center shadow-lg"
          aria-label="Menyunu aç"
        >
          ☰
        </button>
      )}

      {navOpen && (
        <button
          type="button"
          className="md:hidden fixed inset-0 z-30 bg-black/50"
          aria-label="Menyunu bağla"
          onClick={closeNav}
        />
      )}

      <aside
        className={
          'w-64 max-w-[85vw] bg-surface-2 border-r border-white/10 flex flex-col flex-shrink-0 z-40 h-full ' +
          'fixed md:static inset-y-0 left-0 transform transition-transform duration-200 ease-out ' +
          (navOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0') +
          (focusMode ? ' md:-translate-x-full' : '')
        }
      >
        <div className="px-3 py-3 border-b border-white/10 pt-14 md:pt-4">
          <div className="w-full flex items-center justify-center">
            <Brand size="sidebar" imgClassName="scale-[1.4] -my-1" />
          </div>
          <div className="mt-3 p-3 bg-surface-1 rounded-xl border border-white/10">
            <div className="w-8 h-8 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-sm font-bold mb-2">
              {user?.full_name?.split(' ').map((n) => n[0]).join('').slice(0, 2)}
            </div>
            <div className="text-sm font-semibold truncate">{user?.full_name}</div>
            <div className="text-xs text-gray-400">Tələbə</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={closeNav}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <span>{item.icon}</span>
              {item.label}
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

      <main
        className={
          'flex-1 overflow-x-hidden min-w-0 w-full pt-14 md:pt-0 ' +
          (focusMode
            ? 'overflow-y-hidden flex flex-col min-h-0'
            : 'overflow-y-auto')
        }
      >
        {focusMode ? (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <Outlet />
            </div>
          </div>
        ) : (
          <div className="min-h-full flex flex-col">
            <div className="flex-1 min-h-0">
              <Outlet />
            </div>
            <Footer />
          </div>
        )}
      </main>
    </div>
  )
}
