import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import useAuthStore from '../hooks/useAuth'
import Brand from '../components/common/Brand'
import Footer from '../components/common/Footer'
import { sidebarNavClass } from '../lib/sidebarNavClass'
import useUiStore from '../hooks/useUi'
import NavIcon from '../components/common/NavIcon'

const NAV = [
  { to: '/parent', label: 'Uşaqlarım', icon: <NavIcon name="children" />, end: true },
  { to: '/parent/payments', label: 'Ödəniş', icon: <NavIcon name="payments" /> },
  { to: '/parent/notifications', label: 'Bildirişlər', icon: <NavIcon name="notifications" /> },
]

export default function ParentLayout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const { theme, toggleTheme } = useUiStore()

  return (
    <div className={`theme-${theme} flex h-screen bg-token-surfaceMain text-token-textMain overflow-hidden`}>
      <aside
        className={[
          theme === 'dark' ? 'theme-dark' : 'theme-light',
          'w-60 flex flex-col flex-shrink-0',
          theme === 'dark' ? 'bg-[#0d0d0d] border-r border-white/10' : 'bg-[#F8FAFC] border-r border-black/[0.06]',
        ].join(' ')}
      >
        <div className={['px-4 pt-4 pb-4', theme === 'dark' ? 'border-b border-white/10' : 'border-b border-black/[0.06]'].join(' ')}>
          <div className="flex justify-center">
            <Brand size="sidebar" tone={theme === 'dark' ? 'dark' : 'light'} />
          </div>
          <div className={['mt-4 p-3 rounded-xl border', theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white/70 border-black/[0.06]'].join(' ')}>
            <div className={['w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mb-2 border', theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-900/5 border-black/[0.06] text-slate-900'].join(' ')}>
              {user?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
            <div className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{user?.full_name}</div>
            <div className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}`}>Valideyn</div>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}
              className={({ isActive }) => sidebarNavClass(isActive, theme)}>
              <span className="shrink-0">{item.icon}</span>
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className={['p-4', theme === 'dark' ? 'border-t border-white/10' : 'border-t border-black/[0.06]'].join(' ')}>
          <button
            type="button"
            onClick={toggleTheme}
            className={[
              'w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-colors',
              theme === 'dark'
                ? 'border-white/10 bg-white/5 hover:bg-white/10'
                : 'border-black/[0.06] bg-white/70 hover:bg-white',
            ].join(' ')}
          >
            <span className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-200' : 'text-slate-900'}`}>
              Tema
            </span>
            <span className="flex items-center gap-2">
              <span className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}`}>
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
      <main className="flex-1 overflow-y-auto bg-token-surfaceMain">
        <div className="min-h-full flex flex-col">
          <div className="flex-1 min-h-0">
            <Outlet />
          </div>
          <Footer />
        </div>
      </main>
    </div>
  )
}
