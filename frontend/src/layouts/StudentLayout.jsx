import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import useAuthStore from '../hooks/useAuth'
import useUiStore from '../hooks/useUi'
import Brand from '../components/common/Brand'
import Footer from '../components/common/Footer'
import { sidebarNavClass } from '../lib/sidebarNavClass'
import NavIcon from '../components/common/NavIcon'

const NAV = [
  { to: '/student', label: 'Proqresim', icon: <NavIcon name="progress" />, end: true },
  { to: '/student/schedule', label: 'Cədvəlim', icon: <NavIcon name="schedule" /> },
  { to: '/student/exams', label: 'İmtahanlarım', icon: <NavIcon name="exams" /> },
  { to: '/student/assignments', label: 'Tapşırıqlarım', icon: <NavIcon name="tasks" /> },
  { to: '/student/payments', label: 'Ödəniş', icon: <NavIcon name="payments" /> },
  { to: '/student/notifications', label: 'Bildirişlər', icon: <NavIcon name="notifications" /> },
]

export default function StudentLayout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [navOpen, setNavOpen] = useState(false)
  const { focusMode, setFocusMode, theme, toggleTheme } = useUiStore()

  const closeNav = () => setNavOpen(false)

  useEffect(() => {
    if (focusMode) setNavOpen(false)
  }, [focusMode])

  return (
    <div className={`theme-${theme} flex h-screen bg-token-surfaceMain text-token-textMain overflow-hidden`}>
      <button
        type="button"
        onClick={() => setNavOpen(true)}
        className={[
          'md:hidden fixed top-3 left-3 z-50 w-11 h-11 rounded-xl text-lg flex items-center justify-center shadow-lg border',
          'appearance-none focus:outline-none [-webkit-tap-highlight-color:transparent]',
          theme === 'dark'
            ? 'bg-white/5 hover:bg-white/10 active:bg-white/10 border-white/10 text-white'
            : 'bg-transparent hover:bg-gray-50 active:bg-gray-50 border-gray-200 text-gray-900',
        ].join(' ')}
        aria-label="Menyunu aç"
      >
        ☰
      </button>

      {focusMode && (
        <button
          type="button"
          onClick={() => setNavOpen(true)}
          className={[
            'hidden md:flex fixed top-3 left-3 z-[260] w-11 h-11 rounded-xl text-lg items-center justify-center shadow-lg border',
            'appearance-none focus:outline-none [-webkit-tap-highlight-color:transparent]',
            theme === 'dark'
              ? 'bg-white/5 hover:bg-white/10 active:bg-white/10 border-white/10 text-white'
              : 'bg-transparent hover:bg-gray-50 active:bg-gray-50 border-gray-200 text-gray-900',
          ].join(' ')}
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
          'w-64 max-w-[85vw] flex flex-col flex-shrink-0 z-40 h-full ' +
          (theme === 'dark' ? 'theme-dark bg-[#0d0d0d] border-r border-white/10 ' : 'theme-light bg-white border-r border-gray-200 ') +
          'fixed md:static inset-y-0 left-0 transform transition-transform duration-200 ease-out ' +
          (navOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0') +
          (focusMode ? ' md:-translate-x-full' : '')
        }
      >
        <div className={['px-4 pt-14 md:pt-4 pb-4', theme === 'dark' ? 'border-b border-white/10' : 'border-b border-gray-200'].join(' ')}>
          <div className="flex justify-center">
            <Brand size="sidebar" />
          </div>
          <div className={['mt-4 p-3 rounded-xl border', theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'].join(' ')}>
            <div className={['w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mb-2 border', theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-[#003366]/10 border-[#003366]/20 text-[#003366]'].join(' ')}>
              {user?.full_name?.split(' ').map((n) => n[0]).join('').slice(0, 2)}
            </div>
            <div className={`text-sm font-semibold truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{user?.full_name}</div>
            <div className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Tələbə</div>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={closeNav}
              className={({ isActive }) => sidebarNavClass(isActive, theme)}
            >
              <span className="shrink-0">{item.icon}</span>
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className={['p-4', theme === 'dark' ? 'border-t border-white/10' : 'border-t border-gray-200'].join(' ')}>
          <button
            type="button"
            onClick={toggleTheme}
            className={[
              'w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-colors',
              theme === 'dark'
                ? 'border-white/10 bg-white/5 hover:bg-white/10'
                : 'border-gray-200 bg-gray-50 hover:bg-gray-100',
            ].join(' ')}
          >
            <span className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>
              Tema
            </span>
            <span className="flex items-center gap-2">
              <span className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
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
