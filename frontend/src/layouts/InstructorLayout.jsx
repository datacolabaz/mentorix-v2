import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import useAuthStore from '../hooks/useAuth'
import useUiStore from '../hooks/useUi'
import api from '../lib/api'
import { instructorRoleAz } from '../lib/instructorLabel'
import Brand from '../components/common/Brand'
import Footer from '../components/common/Footer'
import { sidebarNavClass } from '../lib/sidebarNavClass'
import NavIcon from '../components/common/NavIcon'

const NAV_SECTIONS = [
  {
    title: 'MANAGEMENT',
    items: [
      { to: '/instructor', label: 'Dashboard', icon: <NavIcon name="dashboard" />, end: true },
      { to: '/instructor/students', label: 'Tələbələrim', icon: <NavIcon name="students" /> },
      { to: '/instructor/schedule', label: 'Cədvəlim', icon: <NavIcon name="schedule" /> },
      { to: '/instructor/attendance', label: 'Davamiyyət', icon: <NavIcon name="attendance" /> },
      { to: '/instructor/exams', label: 'İmtahanlar', icon: <NavIcon name="exams" /> },
      { to: '/instructor/tasks', label: 'Tapşırıqlar', icon: <NavIcon name="tasks" /> },
    ],
  },
  {
    title: 'ANALYTICS',
    items: [
      { to: '/instructor/analytics', label: 'Analitika', icon: <NavIcon name="analytics" /> },
      { to: '/instructor/payments', label: 'Ödənişlər', icon: <NavIcon name="payments" /> },
    ],
  },
  {
    title: 'SYSTEM',
    items: [
      { to: '/instructor/notifications', label: 'Bildirişlər', icon: <NavIcon name="notifications" /> },
      { to: '/instructor/settings', label: 'Tənzimləmələr', icon: <NavIcon name="settings" /> },
    ],
  },
]

export default function InstructorLayout() {
  const { user, logout, updateUser } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [navOpen, setNavOpen] = useState(false)
  const { focusMode, setFocusMode, theme, toggleTheme } = useUiStore()
  const [limitStatus, setLimitStatus] = useState({ level: null, message: null })
  const [notifFetchAt, setNotifFetchAt] = useState(0)
  const [hasAlerts, setHasAlerts] = useState(false)
  const mainRef = useRef(null)

  const debugLayout = useMemo(() => {
    try {
      return new URLSearchParams(location.search).get('debugLayout') === '1'
    } catch {
      return false
    }
  }, [location.search])

  const [debugDims, setDebugDims] = useState(null)
  useEffect(() => {
    if (!debugLayout) return
    const tick = () => {
      const el = mainRef.current
      const r = el?.getBoundingClientRect?.()
      const vv = globalThis.visualViewport
      const ch = el?.clientHeight
      const shEl = el?.scrollHeight
      const stEl = el?.scrollTop
      const mk = document.getElementById('mx_scroll_marker')
      const mr = mk?.getBoundingClientRect?.()
      const vp = document.querySelector('meta[name="viewport"]')?.getAttribute?.('content') || '—'
      const ua = navigator?.userAgent ? String(navigator.userAgent) : '—'
      const sw = globalThis.screen?.width
      const sh = globalThis.screen?.height
      const dpr = globalThis.devicePixelRatio
      const mmSm = globalThis.matchMedia?.('(max-width: 640px)')?.matches
      setDebugDims({
        inner: `${globalThis.innerWidth}×${globalThis.innerHeight}`,
        doc: `${document.documentElement?.clientWidth}×${document.documentElement?.clientHeight}`,
        vv: vv ? `${Math.round(vv.width)}×${Math.round(vv.height)}` : '—',
        main: r ? `${Math.round(r.width)}×${Math.round(r.height)}` : '—',
        mainHeights:
          typeof ch === 'number' || typeof shEl === 'number'
            ? `${Math.round(Number(ch || 0))}/${Math.round(Number(shEl || 0))}`
            : '—',
        mainScrollTop: stEl != null ? String(Math.round(Number(stEl) || 0)) : '—',
        marker: mk ? 'yes' : 'no',
        markerRect: mr ? `${Math.round(mr.x)},${Math.round(mr.y)} ${Math.round(mr.width)}×${Math.round(mr.height)}` : '—',
        scrollY: Math.round(globalThis.scrollY || 0),
        screen: sw && sh ? `${sw}×${sh}` : '—',
        dpr: dpr != null ? String(dpr) : '—',
        sm: mmSm == null ? '—' : mmSm ? 'true' : 'false',
        vp,
        ua: ua.length > 90 ? `${ua.slice(0, 90)}…` : ua,
      })
    }
    tick()
    globalThis.addEventListener?.('resize', tick)
    globalThis.addEventListener?.('scroll', tick, { passive: true })
    return () => {
      globalThis.removeEventListener?.('resize', tick)
      globalThis.removeEventListener?.('scroll', tick)
    }
  }, [debugLayout])

  const notifUnread = useMemo(() => {
    if (!hasAlerts || !notifFetchAt) return false
    try {
      const seen = Number(localStorage.getItem('mx_instructor_notifications_seen_at_v1') || 0)
      return !seen || seen < notifFetchAt
    } catch {
      return hasAlerts
    }
  }, [hasAlerts, notifFetchAt])

  useEffect(() => {
    setNavOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (focusMode) setNavOpen(false)
  }, [focusMode])

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

  useEffect(() => {
    let cancelled = false
    api
      .get('/notifications/instructor')
      .then((d) => {
        if (cancelled) return
        const alerts = d.alerts || []
        setHasAlerts(Array.isArray(alerts) && alerts.length > 0)
        setNotifFetchAt(Date.now())
        const critical = alerts.find((a) => a.level === 'critical')
        const warning = alerts.find((a) => a.level === 'warning')
        if (critical) setLimitStatus({ level: 'critical', message: critical.message })
        else if (warning) setLimitStatus({ level: 'warning', message: warning.message })
        else setLimitStatus({ level: null, message: null })
      })
      .catch(() => {
        if (!cancelled) setLimitStatus({ level: null, message: null })
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div
      className={`theme-${theme} flex flex-col min-h-screen lg:h-screen bg-token-surfaceMain text-token-textMain overflow-x-hidden lg:overflow-hidden`}
    >
      {focusMode && (
        <button
          type="button"
          aria-label="Menyunu aç"
          className="fixed top-4 left-4 z-[260] w-12 h-12 rounded-2xl bg-surface-2 border border-white/10 text-xl flex items-center justify-center shadow-lg"
          onClick={() => setNavOpen(true)}
        >
          ☰
        </button>
      )}
      <header
        className={[
          'lg:hidden fixed top-0 left-0 right-0 z-[1000] h-[72px] flex items-center justify-between gap-2 px-3 overflow-visible',
          theme === 'dark'
            ? 'bg-token-surfaceMain border-b border-[color:var(--border-subtle)] text-token-textMain'
            : 'bg-token-surfaceMain border-b border-[color:var(--border-subtle)] text-token-textMain',
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
          className="lg:hidden fixed inset-0 z-[70] bg-black/60"
          onClick={() => setNavOpen(false)}
        />
      )}

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
            focusMode ? 'lg:-translate-x-full' : '',
            'relative',
          ].join(' ')}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"
          />
          <div
            className={[
              'px-4 pt-4 pb-4 hidden lg:block',
              theme === 'dark' ? 'border-b border-white/10' : 'border-b border-black/[0.06]',
            ].join(' ')}
          >
            <div className="flex justify-center">
              <Brand
                size="sidebar"
                tone={theme === 'dark' ? 'dark' : 'light'}
                className="py-1"
                imgClassName="h-[64px] max-h-[64px] sm:h-[68px] sm:max-h-[68px]"
              />
            </div>
            <div
              className={[
                'mt-4 p-3 rounded-xl border',
                theme === 'dark'
                  ? 'bg-token-surfaceCard/55 border-[color:var(--border-subtle)]'
                  : 'bg-white/70 border-black/[0.06]',
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
              <div className={`text-sm font-semibold break-words ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                {user?.full_name}
              </div>
              <div className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}`}>
                {instructorRoleAz(user?.public_label)}
              </div>
            </div>
          </div>

        <div
          className={[
            'lg:hidden px-4 pt-4 pb-4',
            'border-b border-[color:var(--border-subtle)]',
          ].join(' ')}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0 flex justify-center">
              <Brand
                size="sidebar"
                tone={theme === 'dark' ? 'dark' : 'light'}
                className="py-1"
                imgClassName="h-[64px] max-h-[64px] sm:h-[68px] sm:max-h-[68px]"
              />
            </div>
            <button
              type="button"
              className={[
                'p-2 rounded-xl shrink-0 text-lg leading-none',
                theme === 'dark' ? 'text-gray-300 hover:bg-white/5' : 'text-gray-600 hover:bg-gray-100',
              ].join(' ')}
              onClick={() => setNavOpen(false)}
              aria-label="Bağla"
            >
              ×
            </button>
          </div>
          <div className="mt-4 min-w-0">
            <div className={`text-sm font-semibold truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {user?.full_name}
            </div>
            <div className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              {instructorRoleAz(user?.public_label)}
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-4">
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
                      onClick={() => setNavOpen(false)}
                      className={({ isActive }) => sidebarNavClass(isActive, theme)}
                    >
                      <span className="shrink-0 relative">
                        {item.icon}
                        {item.to === '/instructor/notifications' && notifUnread ? (
                          <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_0_2px_rgba(15,23,42,0.35)]" />
                        ) : null}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </NavLink>
                  ))}
                </div>
                <div className={theme === 'dark' ? 'h-px bg-gradient-to-r from-transparent via-white/10 to-transparent' : 'h-px bg-black/[0.06]'} />
              </div>
            ))}
          </div>
        </nav>

        <div className="p-4 border-t border-[color:var(--border-subtle)]">
          <button
            type="button"
            onClick={toggleTheme}
            className={[
              'w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-colors',
              theme === 'dark'
                ? 'border-[color:var(--border-subtle)] bg-token-surfaceCard/45 hover:bg-token-surfaceCard/60'
                : 'border-[color:var(--border-subtle)] bg-token-surfaceCard/70 hover:bg-token-surfaceCard/90',
            ].join(' ')}
          >
            <span className="text-sm font-medium text-token-textMain">
              Tema
            </span>
            <span className="flex items-center gap-2">
              <span className="text-xs text-token-textMuted">
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
          className="flex-1 min-h-[calc(100vh-72px)] lg:min-h-0 w-full min-w-0 overflow-x-hidden overflow-y-auto pt-[72px] lg:pt-0"
        >
        {debugLayout ? (
          <div className="fixed top-[72px] left-0 right-0 z-[2001] bg-red-600 text-white text-xs font-semibold px-3 py-2">
            MAIN FIXED · path: {location.pathname}
          </div>
        ) : null}
        {debugLayout ? (
          <div className="fixed bottom-3 left-3 z-[2000] rounded-xl border border-white/10 bg-black/75 text-white px-3 py-2 text-[11px] leading-snug">
            <div className="font-bold mb-1">debugLayout=1</div>
            <div>inner: {debugDims?.inner || '—'}</div>
            <div>doc: {debugDims?.doc || '—'}</div>
            <div>vv: {debugDims?.vv || '—'}</div>
            <div>main: {debugDims?.main || '—'}</div>
            <div>main(h/s): {debugDims?.mainHeights || '—'}</div>
            <div>main.scrollTop: {debugDims?.mainScrollTop || '—'}</div>
            <div>marker: {debugDims?.marker || '—'}</div>
            <div>markerRect: {debugDims?.markerRect || '—'}</div>
            <div>scrollY: {debugDims?.scrollY ?? '—'}</div>
            <div>screen: {debugDims?.screen || '—'}</div>
            <div>dpr: {debugDims?.dpr || '—'}</div>
            <div>sm: {debugDims?.sm || '—'}</div>
            <div className="mt-1 break-words">vp: {debugDims?.vp || '—'}</div>
            <div className="mt-1 break-words">ua: {debugDims?.ua || '—'}</div>
            <button
              type="button"
              className="mt-2 w-full rounded-lg bg-white/15 hover:bg-white/20 px-2 py-1 text-left"
              onClick={() => {
                try {
                  const el = mainRef.current
                  if (el) el.scrollTop = 0
                } catch {}
              }}
            >
              ScrollTop=0
            </button>
          </div>
        ) : null}
        <div
          className="min-h-full flex flex-col"
          style={debugLayout ? { outline: '3px solid magenta', background: 'rgba(255,0,255,0.06)' } : undefined}
        >
          {debugLayout ? (
            <div
              id="mx_scroll_marker"
              className="mx-4 sm:mx-6 mt-3 rounded-xl px-3 py-3 text-sm font-extrabold"
              style={{
                background: '#ff00ff',
                color: '#000',
                outline: '3px solid #000',
              }}
            >
              SCROLL CONTENT VISIBLE (debug)
            </div>
          ) : null}
          {limitStatus.level ? (
            <div
              className={`mx-4 sm:mx-6 mt-4 rounded-2xl border px-4 py-3 text-sm ${
                limitStatus.level === 'critical'
                  ? 'border-red-500/40 bg-red-500/10 text-red-200'
                  : 'border-yellow-500/40 bg-yellow-500/10 text-yellow-200'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold">
                    {limitStatus.level === 'critical' ? 'Limit dolub' : 'Diqqət'}
                  </div>
                  <div className="text-white/80 break-words">{limitStatus.message}</div>
                </div>
                <button
                  onClick={() => setLimitStatus({ level: null, message: null })}
                  className="shrink-0 text-white/70 hover:text-white transition-colors"
                  aria-label="Bağla"
                >
                  ×
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex-1 min-h-0">
            {debugLayout ? (
              <div className="px-4 sm:px-6 py-2 text-xs font-semibold text-amber-600">
                OUTLET START (debug)
              </div>
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
