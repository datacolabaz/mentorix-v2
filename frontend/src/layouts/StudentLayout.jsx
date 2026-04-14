import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import useAuthStore from '../hooks/useAuth'

const NAV = [
  { to: '/student', label: 'Proqresim', icon: '📈', end: true },
  { to: '/student/schedule', label: 'Cədvəlim', icon: '📅' },
  { to: '/student/exams', label: 'İmtahanlarım', icon: '📝' },
  { to: '/student/assignments', label: 'Tapşırıqlarım', icon: '📋' },
  { to: '/student/payments', label: 'Ödəniş', icon: '💳' },
]

export default function StudentLayout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [navOpen, setNavOpen] = useState(false)

  const closeNav = () => setNavOpen(false)

  return (
    <div className="flex h-screen bg-[#0f0c29] text-white overflow-hidden">
      <button
        type="button"
        onClick={() => setNavOpen(true)}
        className="md:hidden fixed top-3 left-3 z-50 w-11 h-11 rounded-xl bg-[#13112e] border border-indigo-500/30 text-lg flex items-center justify-center shadow-lg"
        aria-label="Menyunu aç"
      >
        ☰
      </button>

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
          'w-64 max-w-[85vw] bg-[#13112e] border-r border-indigo-500/20 flex flex-col flex-shrink-0 z-40 h-full ' +
          'fixed md:static inset-y-0 left-0 transform transition-transform duration-200 ease-out ' +
          (navOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0')
        }
      >
        <div className="p-5 border-b border-indigo-500/20 pt-14 md:pt-5">
          <div className="font-display font-extrabold text-xl bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            mentorix <span className="text-gray-500 text-xs font-normal">.biz</span>
          </div>
          <div className="mt-3 p-3 bg-[#1a1740] rounded-xl border border-indigo-500/20">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-600 flex items-center justify-center text-sm font-bold mb-2">
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
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/20'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-indigo-500/20">
          <button
            onClick={() => {
              logout()
              navigate('/login')
            }}
            className="flex items-center gap-2 text-red-400 text-sm font-medium hover:text-red-300 transition-colors w-full px-3 py-2 rounded-xl hover:bg-red-500/10"
          >
            → Çıxış
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 w-full pt-14 md:pt-0">
        <Outlet />
      </main>
    </div>
  )
}
