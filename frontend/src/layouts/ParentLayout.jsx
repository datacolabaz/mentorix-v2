import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import useAuthStore from '../hooks/useAuth'
import Brand from '../components/common/Brand'
import Footer from '../components/common/Footer'

const NAV = [
  { to: '/parent', label: 'Uşaqlarım', icon: '👶', end: true },
  { to: '/parent/payments', label: 'Ödəniş', icon: '💳' },
  { to: '/parent/notifications', label: 'Bildirişlər', icon: '🔔' },
]

export default function ParentLayout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  return (
    <div className="flex h-screen bg-[#0b0b0b] text-white overflow-hidden">
      <aside className="w-60 bg-surface-2 border-r border-white/10 flex flex-col flex-shrink-0">
        <div className="px-4 py-3 border-b border-white/10">
          <Brand imgClassName="h-12 max-h-[50px]" className="justify-center" />
          <div className="mt-3 p-3 bg-surface-1 rounded-xl border border-white/10">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-600 flex items-center justify-center text-sm font-bold mb-2">
              {user?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
            <div className="text-sm font-semibold">{user?.full_name}</div>
            <div className="text-xs text-gray-400">Valideyn</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}>
              <span>{item.icon}</span>{item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10">
          <button onClick={() => { logout(); navigate('/login') }}
            className="flex items-center gap-2 text-red-400 text-sm font-medium w-full px-3 py-2 rounded-xl hover:bg-red-500/10">
            → Çıxış
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
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
