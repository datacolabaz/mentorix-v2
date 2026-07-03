import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import useAuthStore from '../hooks/useAuth'
import Brand from '../components/common/Brand'
import Footer from '../components/common/Footer'
import { sidebarNavClass } from '../lib/sidebarNavClass'
import useUiStore from '../hooks/useUi'
import NavIcon from '../components/common/NavIcon'
import SidebarPreferences from '../components/common/SidebarPreferences'

const NAV_SECTION_DEFS = [
  {
    id: 'management',
    titleKey: 'nav.sections.management',
    title: 'MANAGEMENT',
    items: [
      { to: '/admin', key: 'dashboard', labelKey: 'nav.admin.dashboard', label: 'Dashboard', icon: 'dashboard', end: true },
      { to: '/admin/analytics', key: 'analytics', labelKey: 'nav.admin.analytics', label: 'Analitika', icon: 'analytics' },
      { to: '/admin/instructors', key: 'instructors', labelKey: 'nav.admin.instructors', label: 'Müəllimlər', icon: 'instructors' },
      { to: '/admin/students', key: 'students', labelKey: 'nav.admin.students', label: 'Tələbələr', icon: 'students' },
      { to: '/admin/classes', key: 'classes', labelKey: 'nav.admin.classes', label: 'Kurslar / Qruplar', icon: 'courses' },
      { to: '/admin/payments', key: 'payments', labelKey: 'nav.admin.payments', label: 'Ödənişlər', icon: 'payments' },
      { to: '/admin/inventory', key: 'inventory', labelKey: 'nav.admin.inventory', label: 'SMS & Ehtiyat', icon: 'notifications' },
      { to: '/admin/billing', key: 'billing', labelKey: 'nav.admin.billing', label: 'Platform ödənişləri', icon: 'payments' },
    ],
  },
  {
    id: 'system',
    titleKey: 'nav.sections.system',
    title: 'SYSTEM',
    items: [
      { to: '/admin/notifications', key: 'notifications', labelKey: 'nav.admin.notifications', label: 'Bildirişlər', icon: 'notifications' },
      { to: '/admin/marketing/login', key: 'marketingLogin', labelKey: 'nav.admin.marketingLogin', label: 'Landing məzmunu', icon: 'analytics' },
      { to: '/admin/instructor-nav', key: 'instructorNav', labelKey: 'nav.admin.instructorNav', label: 'Müəllim menyusu', icon: 'settings' },
      { to: '/admin/categories', key: 'categories', labelKey: 'nav.admin.categories', label: 'Axtarış kateqoriyaları', icon: 'courses' },
      { to: '/admin/certified-exams', key: 'certifiedExams', labelKey: 'nav.admin.certifiedExams', label: 'Sertifikat verifikasiyası', icon: 'courses' },
      { to: '/admin/settings', key: 'settings', labelKey: 'nav.admin.settings', label: 'Tənzimləmələr', icon: 'settings' },
    ],
  },
]

export default function AdminLayout() {
  const { t, i18n } = useTranslation()
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const { theme } = useUiStore()
  const [navOpen, setNavOpen] = useState(false)
  const navSections = useMemo(
    () =>
      NAV_SECTION_DEFS.map((section) => ({
        title: t(section.titleKey, { defaultValue: section.title }),
        items: section.items.map((item) => ({
          ...item,
          label: t(item.labelKey, { defaultValue: item.label }),
          icon: <NavIcon name={item.icon} />,
        })),
      })),
    [t, i18n.language],
  )

  useEffect(() => {
    setNavOpen(false)
  }, [location.pathname])

  return (
    <div
      className={`theme-${theme} flex flex-col min-h-screen md:h-screen bg-token-surfaceMain text-token-textMain md:overflow-hidden`}
    >
      <header
        className={[
          'md:hidden fixed top-0 left-0 right-0 z-[1000] min-h-[72px] grid grid-cols-[auto_1fr_auto] items-center gap-3 overflow-visible',
          'px-4 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))]',
          'pt-[env(safe-area-inset-top,0px)] bg-token-surfaceMain border-b border-[color:var(--border-subtle)] text-token-textMain shadow-sm',
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
        <div className="flex justify-center min-w-0 overflow-visible justify-self-center">
          <Brand size="md" tone={theme === 'dark' ? 'dark' : 'light'} />
        </div>
        <div className="w-11 shrink-0 justify-self-end" aria-hidden />
      </header>

      {navOpen && (
        <button
          type="button"
          aria-label="Menyunu bağla"
          className="md:hidden fixed inset-0 z-[1090] bg-black/60"
          onClick={() => setNavOpen(false)}
        />
      )}

      <div className="flex flex-col flex-1 min-h-0 md:flex-row">
        <aside
          className={[
            theme === 'dark' ? 'theme-dark' : 'theme-light',
            'w-[min(17rem,calc(100vw-env(safe-area-inset-left,0px)-1rem))] max-w-[280px] md:w-60 flex flex-col flex-shrink-0',
            theme === 'dark'
              ? 'bg-gradient-to-b from-[#0c0f0d] to-[#070a08] border-r border-white/10'
              : 'bg-[#F8FAFC] border-r border-black/[0.06]',
            'fixed md:static inset-y-0 z-[1100] md:z-auto h-full max-h-[100dvh] md:max-h-none',
            'left-[env(safe-area-inset-left,0px)] md:left-auto',
            'transition-[transform,visibility] duration-200 ease-out shadow-2xl md:shadow-none',
            navOpen
              ? 'translate-x-0 visible'
              : '-translate-x-[calc(100%+env(safe-area-inset-left,0px))] invisible md:visible md:translate-x-0',
          ].join(' ')}
        >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"
        />
        <div
          className={[
            'hidden md:block px-4 pt-4 pb-4',
            theme === 'dark' ? 'border-b border-white/10' : 'border-b border-black/[0.06]',
          ].join(' ')}
        >
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

        <div
          className={[
            'md:hidden px-5 pt-4 pb-4 shrink-0',
            theme === 'dark' ? 'border-b border-white/10' : 'border-b border-black/[0.06]',
          ].join(' ')}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold text-token-textMain truncate flex-1 min-w-0">Admin menyu</div>
            <button
              type="button"
              className={[
                'w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-2xl leading-none border',
                theme === 'dark'
                  ? 'text-gray-200 border-white/10 hover:bg-white/5'
                  : 'text-gray-700 border-gray-200 hover:bg-gray-100',
              ].join(' ')}
              onClick={() => setNavOpen(false)}
              aria-label="Bağla"
            >
              ×
            </button>
          </div>
          <div className="mt-3 min-w-0">
            <div className={`text-sm font-semibold truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              {user?.full_name}
            </div>
            <div className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}`}>⚙️ Admin</div>
          </div>
        </div>

        <nav className="flex-1 px-5 py-4 space-y-2 overflow-y-auto min-h-0 overscroll-contain">
          {navSections.map((section) => (
            <div key={section.title} className="space-y-2">
              <div className="px-1 pt-2">
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
                    onClick={() => setNavOpen(false)}
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

        <div
          className={[
            'px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]',
            theme === 'dark' ? 'border-t border-white/10' : 'border-t border-gray-200',
          ].join(' ')}
        >
          <SidebarPreferences
            onLogout={() => {
              logout()
              navigate('/login')
            }}
          />
        </div>
        </aside>

        <main
          className={[
            // Mobile: fixed viewport panel under header (72px).
            'fixed left-0 right-0 bottom-0 top-[calc(72px+env(safe-area-inset-top,0px))] z-[1] w-full min-w-0 overflow-y-auto bg-token-surfaceMain',
            'pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]',
            // Desktop: normal flow next to sidebar.
            'md:static md:inset-auto md:flex-1 md:min-h-0 md:pt-0',
          ].join(' ')}
        >
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
