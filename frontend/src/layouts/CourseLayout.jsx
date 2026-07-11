import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import useAuthStore from '../hooks/useAuth'
import api from '../lib/api'
import useUiStore from '../hooks/useUi'
import Brand from '../components/common/Brand'
import { resolveApiAssetUrl } from '../lib/apiAssetUrl'
import Footer from '../components/common/Footer'
import { sidebarNavClass } from '../lib/sidebarNavClass'
import NavIcon from '../components/common/NavIcon'
import SidebarPreferences from '../components/common/SidebarPreferences'

const NAV_SECTION_DEFS = [
  {
    id: 'management',
    titleKey: 'nav.sections.management',
    title: 'İDARƏETMƏ',
    items: [
      { to: '/course', key: 'dashboard', labelKey: 'nav.course.dashboard', label: 'Dashboard', icon: 'dashboard', end: true },
      { to: '/course/leads', key: 'leads', labelKey: 'nav.course.leads', label: 'Lidlər', icon: 'notifications' },
      { to: '/course/teachers', key: 'teachers', labelKey: 'nav.course.teachers', label: 'Müəllimlər', icon: 'instructors' },
      { to: '/course/students', key: 'students', labelKey: 'nav.course.students', label: 'Tələbələr', icon: 'students' },
      { to: '/course/groups', key: 'groups', labelKey: 'nav.course.groups', label: 'Qruplar / Siniflər', icon: 'groups' },
      { to: '/course/schedule', key: 'schedule', labelKey: 'nav.course.schedule', label: 'Ümumi Cədvəl', icon: 'schedule' },
    ],
  },
  {
    id: 'billing',
    titleKey: 'nav.sections.billing',
    title: 'MALİYYƏ',
    items: [{ to: '/course/finance', key: 'finance', labelKey: 'nav.course.finance', label: 'Ödənişlər', icon: 'payments' }],
  },
  {
    id: 'system',
    titleKey: 'nav.sections.system',
    title: 'SİSTEM',
    items: [
      { to: '/course/notifications', key: 'notifications', labelKey: 'nav.course.notifications', label: 'SMS / Bildirişlər', icon: 'notifications' },
      { to: '/course/settings', key: 'settings', labelKey: 'nav.course.settings', label: 'Parametrlər', icon: 'settings' },
    ],
  },
]

export default function CourseLayout() {
  const { t, i18n } = useTranslation()
  const { user, logout, updateUser } = useAuthStore()
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

  const courseName = user?.course_name || user?.full_name || 'Kurs'
  const courseLogo = user?.course_logo_url ? resolveApiAssetUrl(user.course_logo_url) : null

  useEffect(() => {
    setNavOpen(false)
  }, [location.pathname])

  useEffect(() => {
    let cancelled = false
    api
      .get('/auth/me')
      .then((d) => {
        if (cancelled || !d?.user) return
        updateUser(d.user)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [updateUser])

  return (
    <div
      className={`theme-${theme} flex flex-col min-h-screen lg:h-screen bg-token-surfaceMain text-token-textMain overflow-x-hidden lg:overflow-hidden`}
    >
      <header
        className={[
          'lg:hidden fixed top-0 left-0 right-0 z-[1000] h-[72px] flex items-center justify-between gap-2 px-3 overflow-visible',
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
          <Brand size="md" tone={theme === 'dark' ? 'dark' : 'light'} />
        </div>
        <div className="w-11 shrink-0" />
      </header>

      {navOpen ? (
        <button
          type="button"
          aria-label="Menyunu bağla"
          className="lg:hidden fixed inset-0 z-[70] bg-black/60"
          onClick={() => setNavOpen(false)}
        />
      ) : null}

      <div className="flex flex-col flex-1 min-h-0 lg:flex-row">
        <aside
          className={[
            theme === 'dark' ? 'theme-dark' : 'theme-light',
            'w-[min(17rem,88vw)] max-w-[280px] flex flex-col flex-shrink-0',
            theme === 'dark'
              ? 'bg-gradient-to-b from-[#0c0f0d] to-[#070a08] border-r border-[color:var(--border-subtle)]'
              : 'bg-[#F8FAFC] border-r border-black/[0.06]',
            'fixed lg:static inset-y-0 left-0 z-[80] transition-transform duration-200 ease-out',
            navOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
            'relative',
          ].join(' ')}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent"
          />
          <div
            className={[
              'px-4 pt-14 lg:pt-4 pb-4',
              theme === 'dark' ? 'border-b border-white/10' : 'border-b border-black/[0.06]',
            ].join(' ')}
          >
            <div className="flex justify-center">
              <Brand size="sidebar" tone={theme === 'dark' ? 'dark' : 'light'} />
            </div>
            <div
              className={[
                'mt-4 p-3 rounded-xl border',
                theme === 'dark'
                  ? 'bg-token-surfaceCard/55 border-emerald-500/20'
                  : 'bg-white/70 border-black/[0.06]',
              ].join(' ')}
            >
              <div
                className={[
                  'w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold mb-2 border overflow-hidden',
                  theme === 'dark'
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-100'
                    : 'bg-emerald-600/10 border-emerald-600/20 text-emerald-800',
                ].join(' ')}
              >
                {courseLogo ? (
                  <img src={courseLogo} alt="" className="w-full h-full object-cover" />
                ) : (
                  courseName
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()
                )}
              </div>
              <div className={`text-sm font-semibold break-words ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                {courseName}
              </div>
              <div className={`text-xs ${theme === 'dark' ? 'text-emerald-400/90' : 'text-emerald-700'}`}>
                Tədris Mərkəzi
              </div>
            </div>
          </div>

          <nav className="flex-1 p-4 overflow-y-auto">
            <div className="space-y-4">
              {navSections.map((section) => (
                <div key={section.title} className="space-y-2">
                  <div className="px-4 pt-2">
                    <div
                      className={`text-xs uppercase tracking-wider ${theme === 'dark' ? 'text-token-textMuted/80' : 'text-slate-400'}`}
                    >
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
                </div>
              ))}
            </div>
          </nav>

          <div className={['p-4', theme === 'dark' ? 'border-t border-white/10' : 'border-t border-black/[0.06]'].join(' ')}>
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
            'fixed left-0 right-0 bottom-0 top-[72px] z-[1] w-full min-w-0 overflow-x-hidden overflow-y-auto bg-token-surfaceMain',
            'lg:static lg:inset-auto lg:flex-1 lg:min-h-0 lg:pt-0',
          ].join(' ')}
        >
          <div className="min-h-full flex flex-col">
            <div className="mx-app-content flex-1 min-h-0">
              <Outlet />
            </div>
            <Footer />
          </div>
        </main>
      </div>
    </div>
  )
}
