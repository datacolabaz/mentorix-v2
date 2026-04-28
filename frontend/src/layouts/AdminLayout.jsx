import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import useAuthStore from '../hooks/useAuth'
import Brand from '../components/common/Brand'
import Footer from '../components/common/Footer'
import { sidebarNavClass } from '../lib/sidebarNavClass'
import useUiStore from '../hooks/useUi'
import NavIcon from '../components/common/NavIcon'

const NAV_SECTIONS = [
  {
    title: 'MANAGEMENT',
    items: [
      { to: '/admin', label: 'Dashboard', icon: <NavIcon name="dashboard" />, end: true },
      { to: '/admin/instructors', label: 'Müəllimlər', icon: <NavIcon name="instructors" /> },
      { to: '/admin/payments', label: 'Ödənişlər', icon: <NavIcon name="payments" /> },
    ],
  },
  {
    title: 'SYSTEM',
    items: [
      { to: '/admin/notifications', label: 'Bildirişlər', icon: <NavIcon name="notifications" /> },
      { to: '/admin/settings', label: 'Tənzimləmələr', icon: <NavIcon name="settings" /> },
    ],
  },
]

export default function AdminLayout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const { theme, toggleTheme } = useUiStore()
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => {
    setNavOpen(false)
  }, [location.pathname])

  return (
    <div className={`theme-${theme} flex flex-col h-screen bg-token-surfaceMain text-token-textMain overflow-hidden`}>
      <header
        className={[
          'md:hidden fixed top-0 left-0 right-0 z-[1000] h-[72px] flex items-center justify-between gap-2 px-3 overflow-visible',
          'bg-token-surfaceMain border-b border-[color:var(--border-subtle)] text-token-textMain',
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
          <Brand size="md" />
        </div>
        <div className="w-11 shrink-0" />
      </header>

      {navOpen && (
        <button
          type="button"
          aria-label="Menyunu bağla"
          className="md:hidden fixed inset-0 z-[70] bg-black/60"
          onClick={() => setNavOpen(false)}
        />
      )}

      <div className="flex flex-col flex-1 min-h-0 md:flex-row">
        <aside
          className={[
            theme === 'dark' ? 'theme-dark' : 'theme-light',
            'w-[min(17rem,88vw)] max-w-[280px] md:w-60 flex flex-col flex-shrink-0 h-full',
            theme === 'dark'
              ? 'bg-gradient-to-b from-[#0c0f0d] to-[#070a08] border-r border-white/10'
              : 'bg-[#F8FAFC] border-r border-black/[0.06]',
            'fixed md:static inset-y-0 left-0 z-[80] transition-transform duration-200 ease-out',
            navOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
            'relative',
          ].join(' ')}
        >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"
        />
        <div className={['px-4 pt-14 md:pt-4 pb-4', theme === 'dark' ? 'border-b border-white/10' : 'border-b border-black/[0.06]'].join(' ')}>
          <div className="flex justify-center">
            <Brand size="sidebar" tone={theme === 'dark' ? 'dark' : 'light'} />
          </div>
          <div className={['mt-4 p-3 rounded-xl border', theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white/70 border-black/[0.06]'].join(' ')}>
            <div className={['w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mb-2 border', theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-900/5 border-black/[0.06] text-slate-900'].join(' ')}>
              {user?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
            <div className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{user?.full_name}</div>
            <div className={`text-xs font-semibold ${theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}`}>⚙️ Admin</div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className="space-y-2">
              <div className="px-4 pt-2">
                <div className={`text-xs uppercase tracking-wider ${theme === 'dark' ? 'text-token-textMuted/80' : 'text-slate-400'}`}>
                  {section.title}
                </div>
              </div>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) => sidebarNavClass(isActive, theme)}
                  >
                    <span className="shrink-0">{item.icon}</span>
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                ))}
              </div>
              <div className={theme === 'dark' ? 'h-px bg-gradient-to-r from-transparent via-white/10 to-transparent' : 'h-px bg-black/[0.06]'} />
            </div>
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

          <button onClick={() => { logout(); navigate('/login') }}
            className={[
              'mt-3 flex items-center gap-2 text-sm font-medium transition-colors w-full px-4 py-3 rounded-xl',
              theme === 'dark'
                ? 'text-red-300 hover:text-red-200 hover:bg-red-500/10'
                : 'text-red-600 hover:text-red-700 hover:bg-red-50',
            ].join(' ')}>
            → Çıxış
          </button>
        </div>
        </aside>

        <main className="flex-1 min-h-0 w-full min-w-0 overflow-x-hidden overflow-y-auto bg-token-surfaceMain pt-14 md:pt-0">
        <div className="min-h-full flex flex-col">
          <div className="flex-1 min-h-0">
            <Outlet />
          </div>
          <Footer />
        </div>
        </main>
      </div>
    </div>
  )
}
