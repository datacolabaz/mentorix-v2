import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
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
      { to: '/student/chat', label: 'Qrup çatı', icon: <NavIcon name="chat" /> },
      { to: '/student/direct-chat', label: 'Fərdi çat', icon: <NavIcon name="chat" /> },
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
  const location = useLocation()
  const [navOpen, setNavOpen] = useState(false)
  const { focusMode, setFocusMode, theme, toggleTheme } = useUiStore()
  const { activeEnrollmentId } = useStudentGroups()
  const { tasksBadge, notifBadge } = useStudentAlerts({ enrollmentId: activeEnrollmentId })
  const mainRef = useRef(null)
  const showMobileSidebar = navOpen && !focusMode
  const isChatPage = location.pathname === '/student/chat' || location.pathname === '/student/direct-chat'

  const closeNav = () => setNavOpen(false)

  useEffect(() => {
    setNavOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (focusMode) setNavOpen(false)
  }, [focusMode])

  useEffect(() => {
    const el = mainRef.current
    if (!el) return
    el.scrollLeft = 0
    el.scrollTop = 0
  }, [location.pathname])

  return (
    <>
      <StudentAssignmentAlertModal />
      <div
        className={`theme-${theme} flex flex-col min-h-screen md:h-screen w-full min-w-0 bg-token-surfaceMain text-token-textMain overflow-x-hidden md:overflow-hidden`}
      >
        {focusMode && (
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            className={[
              'md:hidden fixed top-4 left-[max(1rem,env(safe-area-inset-left,0px))] z-[260] w-11 h-11 rounded-2xl text-lg flex items-center justify-center shadow-lg border-2',
              theme === 'dark'
                ? 'bg-white/10 border-white/20 text-white'
                : 'bg-white border-[#003366]/25 text-[#003366]',
            ].join(' ')}
            aria-label="Menyunu aç"
          >
            ☰
          </button>
        )}

        {!focusMode && (
          <header
            className={[
              'md:hidden fixed top-0 left-0 right-0 z-[1100] min-h-[72px] grid grid-cols-[auto_1fr_auto] items-center gap-3 overflow-hidden',
              'px-4 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))]',
              'pt-[env(safe-area-inset-top,0px)] pb-2 bg-token-surfaceMain border-b border-[color:var(--border-subtle)] text-token-textMain shadow-sm',
            ].join(' ')}
          >
            <button
              type="button"
              aria-label="Menyu"
              className={[
                'w-11 h-11 rounded-2xl shrink-0 flex items-center justify-center text-xl font-bold border-2 shadow-md justify-self-start',
                theme === 'dark'
                  ? 'text-white bg-white/10 hover:bg-white/15 border-white/20'
                  : 'text-[#003366] bg-white hover:bg-gray-50 border-[#003366]/25',
              ].join(' ')}
              onClick={() => setNavOpen(true)}
            >
              ☰
            </button>
            <div className="flex justify-center min-w-0 overflow-hidden justify-self-center px-1">
              <Brand size="md" imgClassName="h-9 max-h-10 w-auto max-w-[min(160px,42vw)]" />
            </div>
            <div className="w-11 shrink-0 justify-self-end" aria-hidden />
          </header>
        )}

        {navOpen && (
          <button
            type="button"
            className="md:hidden fixed inset-0 z-[1090] bg-black/60"
            aria-label="Menyunu bağla"
            onClick={closeNav}
          />
        )}

        <div className="flex flex-col flex-1 min-h-0 min-w-0 w-full overflow-x-hidden md:flex-row">
          <aside
            className={[
              theme === 'dark' ? 'theme-dark' : 'theme-light',
              'w-[min(17rem,88vw)] max-w-[280px] flex-col flex-shrink-0',
              theme === 'dark'
                ? 'bg-[#0a0b0f] border-r border-white/10'
                : 'bg-[#F8FAFC] border-r border-black/[0.06]',
              focusMode ? 'hidden' : showMobileSidebar ? 'flex' : 'hidden md:flex',
              'fixed md:static inset-y-0 z-[1100] md:z-auto',
              'left-[env(safe-area-inset-left,0px)] md:left-auto',
              'h-full max-h-[100dvh] md:max-h-none',
              'shadow-2xl md:shadow-none',
              'relative',
            ].join(' ')}
          >
            <div
              className={[
                'px-4 pt-4 pb-4 hidden md:block',
                theme === 'dark' ? 'border-b border-white/10' : 'border-b border-black/[0.06]',
              ].join(' ')}
            >
              <div className="flex justify-center">
                <Brand size="sidebar" tone={theme === 'dark' ? 'dark' : 'light'} />
              </div>
              <div
                className={[
                  'mt-4 p-3 rounded-xl border',
                  theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white/70 border-black/[0.06]',
                ].join(' ')}
              >
                <div
                  className={[
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mb-2 border',
                    theme === 'dark'
                      ? 'bg-white/5 border-white/10 text-white'
                      : 'bg-slate-900/5 border-black/[0.06] text-slate-900',
                  ].join(' ')}
                >
                  {user?.full_name?.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                </div>
                <div className={`text-sm font-semibold truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  {user?.full_name}
                </div>
                <div className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}`}>Tələbə</div>
              </div>
            </div>

            <div
              className={[
                'md:hidden px-4 pt-4 pb-4',
                theme === 'dark' ? 'border-b border-white/10' : 'border-b border-black/[0.06]',
              ].join(' ')}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-token-textMain truncate flex-1 min-w-0">Menyu</div>
                <button
                  type="button"
                  className={[
                    'w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-2xl leading-none border',
                    theme === 'dark'
                      ? 'text-gray-200 border-white/10 hover:bg-white/5'
                      : 'text-gray-700 border-gray-200 hover:bg-gray-100',
                  ].join(' ')}
                  onClick={closeNav}
                  aria-label="Bağla"
                >
                  ×
                </button>
              </div>
            </div>

            <nav className="flex-1 px-4 py-4 space-y-5 overflow-y-auto min-h-0">
              {NAV_GROUPS.map((g) => (
                <div key={g.label} className="space-y-2">
                  <div
                    className={`px-2 text-xs uppercase tracking-wider ${theme === 'dark' ? 'text-token-textMuted/80' : 'text-slate-400'}`}
                  >
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
            ref={mainRef}
            className={[
              focusMode
                ? 'fixed left-0 right-0 bottom-0 top-0 z-[1] w-full min-w-0 overflow-x-hidden overflow-y-hidden flex flex-col'
                : [
                    'fixed left-0 right-0 bottom-0 top-[calc(72px+env(safe-area-inset-top,0px))] z-[1]',
                    'w-full min-w-0 overflow-x-hidden overflow-y-auto overscroll-x-none',
                    'pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))]',
                  ].join(' '),
              'md:static md:inset-auto md:flex-1 md:min-h-0 md:pt-0 md:px-0',
            ].join(' ')}
          >
            {focusMode ? (
              <div className="student-panel-main flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
                <Outlet />
              </div>
            ) : (
              <div className={['min-h-full flex flex-col min-w-0 w-full max-w-full overflow-x-hidden box-border', isChatPage ? 'h-full' : ''].join(' ')}>
                <div className={['student-panel-main flex-1 min-h-0 min-w-0 w-full max-w-full overflow-x-hidden', isChatPage ? 'flex flex-col' : ''].join(' ')}>
                  <Outlet />
                </div>
                {!isChatPage ? <Footer /> : null}
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  )
}
