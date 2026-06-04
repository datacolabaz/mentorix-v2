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
import BillingBanner from '../components/common/BillingBanner'
import BillingUsagePills from '../components/common/BillingUsagePills'
import { useBillingStatus } from '../hooks/useBillingStatus'
import UpgradeModal from '../components/instructor/UpgradeModal'
import LimitReachedModal from '../components/instructor/LimitReachedModal'
import BillingLimitTopUpModal from '../components/instructor/BillingLimitTopUpModal'
import { useSubscriptionPlans } from '../hooks/useSubscriptionPlans'
import { isSmsMonthlyLimitReached, isStorageLimitReached } from '../lib/subscriptionPlanGuards'
import { useQueryClient } from '@tanstack/react-query'
import { BILLING_STATUS_QUERY_KEY } from '../hooks/useBillingStatus'
import { useToast } from '../components/common/Toast'
import InstructorPhoneGate from '../components/instructor/InstructorPhoneGate'

const NAV_SECTIONS = [
  {
    title: 'MANAGEMENT',
    items: [
      { to: '/instructor', label: 'Dashboard', icon: <NavIcon name="dashboard" />, end: true },
      { to: '/instructor/teaching-groups', label: 'Kurslar və qruplar', icon: <NavIcon name="courses" /> },
      { to: '/instructor/students', label: 'Tələbələrim', icon: <NavIcon name="students" /> },
      { to: '/instructor/join-requests', label: 'Sorğular', icon: <NavIcon name="notifications" />, badgeKey: 'join_requests' },
      { to: '/instructor/inquiries', label: 'Xəritə müraciətləri', icon: <NavIcon name="instructors" /> },
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
  const { focusMode, setFocusMode, overlayLock, theme, toggleTheme } = useUiStore()
  const sidebarHidden = focusMode || overlayLock
  const [limitStatus, setLimitStatus] = useState({ level: null, message: null })
  const [notifFetchAt, setNotifFetchAt] = useState(0)
  const [hasAlerts, setHasAlerts] = useState(false)
  const [joinRequestsCount, setJoinRequestsCount] = useState(0)
  const billingQ = useBillingStatus()
  const billing = billingQ.data || null
  const plansQ = useSubscriptionPlans()
  const currentPlanTitle = useMemo(() => {
    const pid = String(billing?.plan || '').toLowerCase()
    const p = (Array.isArray(plansQ.data) ? plansQ.data : []).find(
      (x) => String(x?.id || '').toLowerCase() === pid,
    )
    return p?.title || (pid === 'premium' || pid === 'business' ? 'PREMIUM' : pid.toUpperCase())
  }, [billing?.plan, plansQ.data])
  const [topUpModalOpen, setTopUpModalOpen] = useState(false)
  const topUpPromptSigRef = useRef('')
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [limitModal, setLimitModal] = useState({
    open: false,
    message: '',
    primaryLabel: 'Paketlərə bax',
    action: 'OPEN_SETTINGS_PLANS',
  })
  const toast = useToast()
  const lastTrackedRef = useRef({ warning: false, blocked: false })

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
    if (focusMode || overlayLock) setNavOpen(false)
  }, [focusMode, overlayLock])

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

  const runBillingAction = (action) => {
    const act = action || 'OPEN_SETTINGS_PLANS'
    api.post('/billing/events', { event: 'upgrade_clicked', context: { at: 'banner', action: act } }).catch(() => {})
    if (act === 'OPEN_UPGRADE_MODAL') {
      setUpgradeOpen(true)
      return
    }
    if (act === 'OPEN_SMS_TOPUP') {
      navigate('/instructor/settings', { state: { scrollTo: 'billing-sms-addons' } })
      return
    }
    if (act === 'OPEN_STORAGE_TOPUP') {
      navigate('/instructor/settings', { state: { openStorageAddon: true } })
      return
    }
    if (act === 'OPEN_SETTINGS_PAYMENTS') {
      navigate('/instructor/settings', { state: { scrollTo: 'billing-payments' } })
      return
    }
    if (act === 'OPEN_SETTINGS_STORAGE') {
      navigate('/instructor/exams')
      return
    }
    navigate('/instructor/settings')
  }

  useEffect(() => {
    let cancelled = false
    api
      .get('/notifications/instructor')
      .then((d) => {
        if (cancelled) return
        const alerts = d.alerts || []
        setHasAlerts(Array.isArray(alerts) && alerts.length > 0)
        setNotifFetchAt(Date.now())
        if (d.billing_messages?.suppress_limit_bar) {
          setLimitStatus({ level: null, message: null })
          return
        }
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
  }, [billing?.messages?.suppress_limit_bar])

  const fetchJoinRequestsCount = () => {
    api
      .get('/instructor/join-requests/count')
      .then((d) => setJoinRequestsCount(Number(d?.count ?? 0) || 0))
      .catch(() => setJoinRequestsCount(0))
  }

  useEffect(() => {
    fetchJoinRequestsCount()
    const onChange = () => fetchJoinRequestsCount()
    window.addEventListener('mx:join-requests-changed', onChange)
    return () => window.removeEventListener('mx:join-requests-changed', onChange)
  }, [location.pathname])

  useEffect(() => {
    const st = String(billing?.status || '')
    if (!st) return
    if (st === 'warning' && !lastTrackedRef.current.warning) {
      lastTrackedRef.current.warning = true
      api.post('/billing/events', { event: 'billing_warning_shown', context: { status: st } }).catch(() => {})
    }
    if ((st === 'blocked' || st === 'expired') && !lastTrackedRef.current.blocked) {
      lastTrackedRef.current.blocked = true
      api.post('/billing/events', { event: 'billing_blocked', context: { status: st } }).catch(() => {})
    }
  }, [billing?.status])

  const smsLimitReached = Boolean(billing && isSmsMonthlyLimitReached(billing))
  const storageLimitReached = Boolean(billing && isStorageLimitReached(billing))

  useEffect(() => {
    if (!billing?.is_highest_tier) return
    if (!smsLimitReached && !storageLimitReached) return
    const st = String(billing?.status || '')
    if (st !== 'blocked' && st !== 'warning') return
    const sig = `${billing.plan}:${st}:${smsLimitReached}:${storageLimitReached}`
    if (topUpPromptSigRef.current === sig) return
    topUpPromptSigRef.current = sig
    setTopUpModalOpen(true)
  }, [billing, smsLimitReached, storageLimitReached])

  useEffect(() => {
    const onUsageLimit = (ev) => {
      const code = ev?.detail?.code
      const message = ev?.detail?.message || ''
      if (billing?.is_highest_tier && (code === 'SMS_LIMIT' || code === 'STORAGE_LIMIT')) {
        setTopUpModalOpen(true)
        return
      }
      setLimitModal({
        open: true,
        message,
        primaryLabel: code === 'SMS_LIMIT' ? 'SMS Balansı Artır' : 'Paketlərə bax',
        action: code === 'SMS_LIMIT' ? 'OPEN_SMS_TOPUP' : 'OPEN_SETTINGS_PLANS',
      })
    }
    window.addEventListener('mx:usage-limit', onUsageLimit)
    return () => window.removeEventListener('mx:usage-limit', onUsageLimit)
  }, [billing?.is_highest_tier])

  return (
    <>
      <InstructorPhoneGate />
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
            // Modal açıq olanda lg:static saxlamırıq — yoxsa sidebar yer tutur və modalın altında qalır.
            sidebarHidden
              ? 'fixed inset-y-0 left-0 z-[80]'
              : 'fixed lg:static inset-y-0 left-0 z-[80]',
            'transition-transform duration-200 ease-out',
            sidebarHidden
              ? '-translate-x-full pointer-events-none'
              : navOpen
                ? 'translate-x-0'
                : '-translate-x-full lg:translate-x-0',
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
            {billing ? (
              <div className="mt-3">
                <BillingUsagePills billing={billing} planTitle={currentPlanTitle} />
              </div>
            ) : null}
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
          {billing ? (
            <div className="mt-3">
              <BillingUsagePills billing={billing} planTitle={currentPlanTitle} collapsible />
            </div>
          ) : null}
        </div>

        <nav className="flex-1 p-4 overflow-y-auto min-h-0">
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
                      <span className="truncate flex-1">{item.label}</span>
                      {item.badgeKey === 'join_requests' && joinRequestsCount > 0 ? (
                        <span className="shrink-0 min-w-[1.25rem] h-5 px-1.5 rounded-full bg-primary text-[#041018] text-[10px] font-bold inline-flex items-center justify-center">
                          {joinRequestsCount > 99 ? '99+' : joinRequestsCount}
                        </span>
                      ) : null}
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
          className={[
            // Mobile: make content a fixed viewport panel under header (prevents iOS/WebKit height/flow quirks).
            'fixed left-0 right-0 bottom-0 top-[72px] z-[1] w-full min-w-0 overflow-x-hidden overflow-y-auto',
            // Desktop: normal flow next to sidebar.
            'lg:static lg:inset-auto lg:flex-1 lg:min-h-0 lg:pt-0',
          ].join(' ')}
        >
        <div className="min-h-full flex flex-col">
          <div className="mx-4 sm:mx-6 mt-4">
            <BillingBanner
              status={billing?.status}
              tone={billing?.messages?.tone || null}
              banner={billing?.messages?.banner || null}
              cta={billing?.messages?.cta || null}
              onCta={() => {
                const action =
                  billing?.messages?.cta && typeof billing.messages.cta === 'object'
                    ? billing.messages.cta.action
                    : null
                runBillingAction(action)
              }}
            />
          </div>
          {limitStatus.level && !billing?.messages?.suppress_limit_bar && !billing?.messages?.banner ? (
            <div
              className={`mx-4 sm:mx-6 mt-4 rounded-2xl border px-4 py-3 text-sm ${
                limitStatus.level === 'critical'
                  ? theme === 'dark'
                    ? 'border-red-500/40 bg-red-500/10 text-red-200'
                    : 'border-red-600/30 bg-red-50 text-red-950'
                  : theme === 'dark'
                    ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-200'
                    : 'border-amber-600/30 bg-amber-50 text-amber-950'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold">
                    {limitStatus.level === 'critical' ? 'Limit dolub' : 'Diqqət'}
                  </div>
                  <div
                    className={[
                      'break-words',
                      theme === 'dark'
                        ? 'text-white/85'
                        : limitStatus.level === 'critical'
                          ? 'text-red-950/90'
                          : 'text-amber-950/90',
                    ].join(' ')}
                  >
                    {limitStatus.message}
                  </div>
                </div>
                <button
                  onClick={() => setLimitStatus({ level: null, message: null })}
                  className={
                    theme === 'dark'
                      ? 'shrink-0 text-white/70 hover:text-white transition-colors'
                      : 'shrink-0 text-amber-900/55 hover:text-amber-950 transition-colors'
                  }
                  aria-label="Bağla"
                >
                  ×
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex-1 min-h-0">
            <Outlet />
          </div>

          <Footer />
        </div>
      </main>
      </div>
    </div>
      <BillingLimitTopUpModal
        open={topUpModalOpen}
        onClose={() => setTopUpModalOpen(false)}
        planTitle={currentPlanTitle}
        smsReached={smsLimitReached}
        storageReached={storageLimitReached}
        onBuySms={() => {
          setTopUpModalOpen(false)
          navigate('/instructor/settings', { state: { scrollTo: 'billing-sms-addons' } })
        }}
        onManageStorage={() => {
          setTopUpModalOpen(false)
          navigate('/instructor/settings', { state: { openStorageAddon: true } })
        }}
      />
      <LimitReachedModal
        open={limitModal.open}
        onClose={() => setLimitModal({ open: false, message: '', primaryLabel: 'Paketlərə bax', action: 'OPEN_SETTINGS_PLANS' })}
        serverMessage={limitModal.message}
        primaryLabel={limitModal.primaryLabel}
        onPrimary={() => {
          const action = limitModal.action || 'OPEN_SETTINGS_PLANS'
          setLimitModal({ open: false, message: '', primaryLabel: 'Paketlərə bax', action: 'OPEN_SETTINGS_PLANS' })
          runBillingAction(action)
        }}
      />
      <UpgradeModal
      open={upgradeOpen}
      onClose={() => setUpgradeOpen(false)}
      currentPlan={billing?.plan}
      onSelectPlan={(plan) => {
        api.post('/billing/events', { event: 'upgrade_plan_selected', context: { plan } }).catch(() => {})
        // revenue-safe: request only (no free plan switch here)
        api.post('/billing/events', { event: 'upgrade_request_created', context: { plan } }).catch(() => {})
        setUpgradeOpen(false)
      }}
    />
    </>
  )
}
