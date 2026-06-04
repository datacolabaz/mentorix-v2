import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import useAuthStore from '../hooks/useAuth'
import useUiStore from '../hooks/useUi'
import Brand from '../components/common/Brand'
import Footer from '../components/common/Footer'
import { sidebarNavClass } from '../lib/sidebarNavClass'
import NavIcon from '../components/common/NavIcon'
import { StudentGroupProvider, useStudentGroups } from '../contexts/StudentGroupContext'
import { useStudentAlerts } from '../hooks/useStudentAlerts'
import StudentAssignmentAlertModal from '../components/student/StudentAssignmentAlertModal'

function NavBadge({ count }) {
  if (!count || count < 1) return null
  const label = count > 99 ? '99+' : String(count)
  return (
    <span className="ml-auto min-w-[1.25rem] h-5 px-1.5 rounded-full bg-violet-500 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
      {label}
    </span>
  )
}

const NAV_GROUPS = [
  {
    label: 'MANAGEMENT',
    items: [
      { to: '/student', label: 'Proqresim', icon: <NavIcon name="progress" />, end: true },
      { to: '/student/groups', label: 'Qruplarım', icon: <NavIcon name="courses" /> },
      { to: '/student/schedule', label: 'Cədvəlim', icon: <NavIcon name="schedule" /> },
      { to: '/student/exams', label: 'İmtahanlarım', icon: <NavIcon name="exams" /> },
      { to: '/student/assignments', label: 'Tapşırıqlarım', icon: <NavIcon name="tasks" />, badgeKey: 'tasks' },
    ],
  },
  {
    label: 'BILLING',
    items: [
      { to: '/student/payments', label: 'Ödəniş', icon: <NavIcon name="payments" /> },
    ],
  },
  {
    label: 'COMMUNICATION',
    items: [
      { to: '/student/notifications', label: 'Bildirişlər', icon: <NavIcon name="notifications" />, badgeKey: 'notifications' },
    ],
  },
]

export default function StudentLayout() {
  return (
    <StudentGroupProvider>
      <StudentLayoutInner />
    </StudentGroupProvider>
  )
}

function StudentLayoutInner() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [navOpen, setNavOpen] = useState(false)
  const { focusMode, setFocusMode, theme, toggleTheme } = useUiStore()
  const { activeEnrollmentId } = useStudentGroups()
  const { tasksBadge, notifBadge } = useStudentAlerts({ enrollmentId: activeEnrollmentId })

  const closeNav = () => setNavOpen(false)

  useEffect(() => {
    if (focusMode) setNavOpen(false)
  }, [focusMode])

  return (
    <>
    <StudentAssignmentAlertModal />
    <div
      className={`theme-${theme} flex flex-col min-h-screen md:h-screen bg-token-surfaceMain text-token-textMain overflow-x-hidden md:overflow-hidden`}
    >
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

      <div className="flex flex-col flex-1 min-h-0 md:flex-row">
        <aside
          className={
            'w-64 max-w-[85vw] flex flex-col flex-shrink-0 z-40 h-full ' +
            (theme === 'dark'
              ? 'theme-dark bg-[#0a0b0f] border-r border-white/10 '
              : 'theme-light bg-[#F8FAFC] border-r border-black/[0.06] ') +
            'bg-gradient-to-b from-black/[0.14] via-transparent to-black/[0.08] ' +
            'fixed md:static inset-y-0 left-0 transform transition-transform duration-200 ease-out ' +
            (navOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0') +
            (focusMode ? ' md:-translate-x-full' : '')
          }
        >
        <div className={['px-4 pt-14 md:pt-4 pb-4', theme === 'dark' ? 'border-b border-white/10' : 'border-b border-black/[0.06]'].join(' ')}>
          <div className="flex justify-center">
            <Brand size="sidebar" tone={theme === 'dark' ? 'dark' : 'light'} />
          </div>
          <div className={['mt-4 p-3 rounded-xl border', theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white/70 border-black/[0.06]'].join(' ')}>
            <div className={['w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mb-2 border', theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-900/5 border-black/[0.06] text-slate-900'].join(' ')}>
              {user?.full_name?.split(' ').map((n) => n[0]).join('').slice(0, 2)}
            </div>
            <div className={`text-sm font-semibold truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{user?.full_name}</div>
            <div className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}`}>Tələbə</div>
          </div>
        </div>
        <nav className="flex-1 px-4 py-4 space-y-5 overflow-y-auto">
          {NAV_GROUPS.map((g) => (
            <div key={g.label} className="space-y-2">
              <div className={`px-2 text-xs uppercase tracking-wider ${theme === 'dark' ? 'text-token-textMuted/80' : 'text-slate-400'}`}>
                {g.label}
              </div>
              <div className="space-y-1">
                {g.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={closeNav}
                    className={({ isActive }) => sidebarNavClass(isActive, theme)}
                  >
                    <span className="shrink-0">{item.icon}</span>
                    <span className="truncate">{item.label}</span>
                    {item.badgeKey === 'tasks' ? <NavBadge count={tasksBadge} /> : null}
                    {item.badgeKey === 'notifications' ? <NavBadge count={notifBadge} /> : null}
                  </NavLink>
                ))}
              </div>
              <div className={theme === 'dark' ? 'h-px bg-[color:var(--border-subtle)]/60' : 'h-px bg-black/[0.06]'} />
            </div>
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
            // Mobile: fixed viewport panel under header (56px).
            'fixed left-0 right-0 bottom-0 top-0 z-[1] w-full overflow-x-hidden min-w-0 ' +
            (focusMode ? 'overflow-y-hidden flex flex-col' : 'overflow-y-auto') +
            // Desktop: normal flow (avoid overlay/offset issues when switching sidebar items)
            ' md:static md:inset-auto md:w-full md:h-auto md:min-w-0'
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
    </div>
    </>
  )
}
