import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import useAuthStore from '../hooks/useAuth'
import Brand from '../components/common/Brand'
import Footer from '../components/common/Footer'
import { sidebarNavClass } from '../lib/sidebarNavClass'

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: '📊', end: true },
  { to: '/admin/instructors', label: 'Müəllimlər', icon: '👨‍🏫' },
  { to: '/admin/payments', label: 'Ödənişlər', icon: '💳' },
  { to: '/admin/notifications', label: 'Bildirişlər', icon: '🔔' },
  { to: '/admin/settings', label: 'Tənzimləmələr', icon: '⚙️' },
]

export default function AdminLayout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  return (
    <div className="flex h-screen bg-[#0b0b0b] text-white overflow-hidden">
      <aside className="w-60 bg-brand-sidebar border-r border-white/10 flex flex-col flex-shrink-0">
        <div className="px-2 py-2 border-b border-white/10">
          <div className="mb-5">
            <Brand size="sidebar" />
          </div>
          <div className="p-3 bg-black/25 rounded-xl border border-white/15">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center text-sm font-bold mb-2">
              {user?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
            <div className="text-sm font-semibold">{user?.full_name}</div>
            <div className="text-xs text-orange-400 font-semibold">⚙️ Admin</div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}
              className={({ isActive }) => sidebarNavClass(isActive)}>
              <span>{item.icon}</span>{item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <button onClick={() => { logout(); navigate('/login') }}
            className="flex items-center gap-2 text-red-400 text-sm font-medium hover:text-red-300 transition-colors w-full px-3 py-2 rounded-xl hover:bg-red-500/10">
            → Çıxış
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-[#0b0b0b]">
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
