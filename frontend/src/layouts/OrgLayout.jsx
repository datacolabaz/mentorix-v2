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
import { filterOrgNav } from '../constants/orgNav'
import { OrgWorkspaceProvider, useOrgWorkspace } from '../hooks/useOrgWorkspace'

const COLLAPSE_KEY = 'mx_org_sidebar_collapsed_v1'

function OrgSidebarChrome() {
  const { t, i18n } = useTranslation()
  const { user, logout, updateUser } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const { theme } = useUiStore()
  const { workspace, permissions, loading, error } = useOrgWorkspace()
  const [navOpen, setNavOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1'
    } catch {
      return false
    }
  })

  const navSections = useMemo(() => {
    return filterOrgNav(permissions).map((section) => ({
      ...section,
      title: t(section.titleKey, { defaultValue: section.title }),
      items: section.items.map((item) => ({
        ...item,
        label: t(item.labelKey, { defaultValue: item.label }),
      })),
    }))
  }, [t, i18n.language, permissions])

  const orgName = workspace?.course_name || user?.course_name || user?.full_name || t('org.common.fallbackName')
  const orgLogo = workspace?.logo_url || user?.course_logo_url
  const logoSrc = orgLogo ? resolveApiAssetUrl(orgLogo) : null

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

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const asideWidth = collapsed ? 'lg:w-[4.75rem]' : 'lg:w-[17rem]'

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
          aria-label={t('layout.menu')}
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
          aria-label={t('layout.closeMenu')}
          className="lg:hidden fixed inset-0 z-[70] bg-black/60"
          onClick={() => setNavOpen(false)}
        />
      ) : null}

      <div className="flex flex-col flex-1 min-h-0 lg:flex-row">
        <aside
          className={[
            theme === 'dark' ? 'theme-dark' : 'theme-light',
            'w-[min(17rem,88vw)] max-w-[280px] flex flex-col flex-shrink-0',
            asideWidth,
            theme === 'dark'
              ? 'bg-[#080b09] border-r border-white/[0.07]'
              : 'bg-[#F4F6F8] border-r border-black/[0.06]',
            'fixed lg:static inset-y-0 left-0 z-[80] transition-[transform,width] duration-200 ease-out',
            navOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
            'relative',
          ].join(' ')}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/25 to-transparent"
          />
          <div className={['px-3 pt-14 lg:pt-3 pb-3', theme === 'dark' ? 'border-b border-white/10' : 'border-b border-black/[0.06]'].join(' ')}>
            <div className={`flex ${collapsed ? 'justify-center' : 'justify-between items-center'} gap-2`}>
              {!collapsed ? <Brand size="sidebar" tone={theme === 'dark' ? 'dark' : 'light'} /> : null}
              <button
                type="button"
                className="hidden lg:inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-token-textMuted hover:text-token-textMain hover:bg-white/5"
                aria-label={collapsed ? t('org.common.expandSidebar') : t('org.common.collapseSidebar')}
                title={collapsed ? t('org.common.expand') : t('org.common.collapse')}
                onClick={toggleCollapsed}
              >
                {collapsed ? '›' : '‹'}
              </button>
            </div>
            {!collapsed ? (
              <div
                className={[
                  'mt-3 p-2.5 rounded-xl border',
                  theme === 'dark' ? 'bg-white/[0.03] border-emerald-500/15' : 'bg-white/80 border-black/[0.06]',
                ].join(' ')}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={[
                      'w-9 h-9 rounded-lg flex items-center justify-center text-[11px] font-bold border overflow-hidden shrink-0',
                      theme === 'dark'
                        ? 'bg-emerald-500/12 border-emerald-500/25 text-emerald-100'
                        : 'bg-emerald-600/10 border-emerald-600/20 text-emerald-800',
                    ].join(' ')}
                  >
                    {logoSrc ? (
                      <img src={logoSrc} alt="" className="w-full h-full object-cover" />
                    ) : (
                      orgName
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className={`text-[13px] font-semibold truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      {loading ? '…' : orgName}
                    </div>
                    <div className={`text-[10px] uppercase tracking-[0.12em] ${theme === 'dark' ? 'text-emerald-400/90' : 'text-emerald-700'}`}>
                      {t('nav.org.orgBadge', { defaultValue: 'Təşkilat' })}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex justify-center" title={orgName}>
                <div className="w-9 h-9 rounded-lg overflow-hidden border border-emerald-500/25 bg-emerald-500/12 text-[11px] font-bold flex items-center justify-center text-emerald-100">
                  {logoSrc ? <img src={logoSrc} alt="" className="w-full h-full object-cover" /> : orgName.slice(0, 1).toUpperCase()}
                </div>
              </div>
            )}
          </div>

          <nav className="flex-1 px-2 py-3 overflow-y-auto">
            <div className="space-y-3">
              {navSections.map((section) => (
                <div key={section.id} className="space-y-1">
                  {!collapsed ? (
                    <div className="px-3 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-token-textMuted/70">
                      {section.title}
                    </div>
                  ) : (
                    <div className="h-px mx-2 bg-white/10" />
                  )}
                  <div className="space-y-0.5">
                    {section.items.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        title={collapsed ? item.label : undefined}
                        onClick={() => setNavOpen(false)}
                        className={({ isActive }) =>
                          [
                            sidebarNavClass(isActive, theme),
                            collapsed ? '!px-0 !gap-0 justify-center' : '!py-2 !text-[13px]',
                          ].join(' ')
                        }
                      >
                        <span className="shrink-0">
                          <NavIcon name={item.icon} className="w-[18px] h-[18px]" />
                        </span>
                        {!collapsed ? <span className="truncate">{item.label}</span> : null}
                      </NavLink>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </nav>

          {!collapsed ? (
            <div className={['p-3', theme === 'dark' ? 'border-t border-white/10' : 'border-t border-black/[0.06]'].join(' ')}>
              <SidebarPreferences
                onLogout={() => {
                  logout()
                  navigate('/login')
                }}
              />
            </div>
          ) : (
            <div className="p-2 border-t border-white/10">
              <button
                type="button"
                className="w-full h-9 rounded-lg text-xs text-red-300 hover:bg-red-500/10"
                onClick={() => {
                  logout()
                  navigate('/login')
                }}
                title={t('layout.logout')}
              >
                →
              </button>
            </div>
          )}
        </aside>

        <main
          className={[
            'fixed left-0 right-0 bottom-0 top-[72px] z-[1] w-full min-w-0 overflow-x-hidden overflow-y-auto bg-token-surfaceMain',
            'lg:static lg:inset-auto lg:flex-1 lg:min-h-0 lg:pt-0',
          ].join(' ')}
        >
          <div className="min-h-full flex flex-col">
            <div className="flex-1 min-h-0">
              {error ? (
                <p className="px-4 sm:px-6 pt-4 text-sm text-red-300/90">{error}</p>
              ) : null}
              <Outlet />
            </div>
            <Footer />
          </div>
        </main>
      </div>
    </div>
  )
}

export default function OrgLayout() {
  return (
    <OrgWorkspaceProvider>
      <OrgSidebarChrome />
    </OrgWorkspaceProvider>
  )
}
