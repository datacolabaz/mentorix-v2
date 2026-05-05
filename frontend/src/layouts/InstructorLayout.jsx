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
import Modal from '../components/common/Modal'
import PhoneInput from '../components/auth/PhoneInput'
import Button from '../components/common/Button'
import { useToast } from '../components/common/Toast'

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
  const billingQ = useBillingStatus()
  const billing = billingQ.data || null
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [verifyOpen, setVerifyOpen] = useState(false)
  const [verifyPhone, setVerifyPhone] = useState(user?.phone || '')
  const [verifyCode, setVerifyCode] = useState('')
  const [verifyStep, setVerifyStep] = useState('phone') // phone | code
  const [verifyBusy, setVerifyBusy] = useState(false)
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
    setVerifyPhone(user?.phone || '')
  }, [user?.phone])

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

  return (
    <>
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
            {billing ? (
              <div className="mt-3">
                <BillingUsagePills billing={billing} />
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
              banner={billing?.messages?.banner || null}
              cta={billing?.messages?.cta || null}
              onCta={() => {
                api.post('/billing/events', { event: 'upgrade_clicked', context: { at: 'banner' } }).catch(() => {})
                const action = billing?.messages?.cta && typeof billing.messages.cta === 'object' ? billing.messages.cta.action : null
                if (action === 'OPEN_VERIFY_PHONE') {
                  setVerifyStep('phone')
                  setVerifyCode('')
                  setVerifyOpen(true)
                  return
                }
                if (action === 'OPEN_UPGRADE_MODAL') return setUpgradeOpen(true)
                navigate('/instructor/settings')
              }}
            />
          </div>
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
            <Outlet />
          </div>

          <Footer />
        </div>
      </main>
      </div>
    </div>
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
    <Modal
      open={verifyOpen}
      onClose={() => {
        if (verifyBusy) return
        setVerifyOpen(false)
      }}
      title="Telefon təsdiqi"
      size="sm"
    >
      {verifyStep === 'phone' ? (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault()
            setVerifyBusy(true)
            try {
              await api.post('/auth/phone/verify/send', { phone: verifyPhone })
              setVerifyStep('code')
              toast('OTP göndərildi', 'success')
            } catch (err) {
              toast(err?.message || 'OTP göndərilmədi', 'error')
            } finally {
              setVerifyBusy(false)
            }
          }}
        >
          <p className="text-xs text-gray-400">
            Telefon təsdiqi tamamlanmadan tələbə əlavə etmək və trial aktivləşdirmək mümkün deyil.
          </p>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Telefon nömrəsi</label>
            <PhoneInput value={verifyPhone} onChange={setVerifyPhone} required />
          </div>
          <Button type="submit" loading={verifyBusy} className="w-full justify-center py-3">
            OTP göndər
          </Button>
        </form>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault()
            setVerifyBusy(true)
            try {
              const r = await api.post('/auth/phone/verify/confirm', { phone: verifyPhone, code: verifyCode })
              if (r?.user) {
                updateUser(r.user)
                try {
                  localStorage.setItem('mx_onboard_add_student_v1', '1')
                } catch {}
              }
              toast('Telefon təsdiqləndi', 'success')
              setVerifyOpen(false)
              navigate('/instructor/students')
            } catch (err) {
              toast(err?.message || 'Kod yanlışdır', 'error')
            } finally {
              setVerifyBusy(false)
            }
          }}
        >
          <p className="text-xs text-gray-400 text-center">
            Telefonunuza gələn <strong className="text-gray-200">6 rəqəmli OTP</strong> kodunu daxil edin.
          </p>
          <div className="text-center text-xs text-gray-500">{verifyPhone}</div>
          <input
            className="w-full bg-surface-1 border border-white/10 rounded-xl px-4 py-4 text-white text-2xl font-bold text-center tracking-widest outline-none focus:border-primary/40"
            maxLength={6}
            inputMode="numeric"
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
            required
          />
          <Button type="submit" loading={verifyBusy} className="w-full justify-center py-3">
            Təsdiqlə
          </Button>
          <button
            type="button"
            disabled={verifyBusy}
            onClick={async () => {
              setVerifyBusy(true)
              try {
                await api.post('/auth/phone/verify/send', { phone: verifyPhone })
                toast('OTP yenidən göndərildi', 'success')
              } catch (e) {
                toast(e?.message || 'OTP göndərilmədi', 'error')
              } finally {
                setVerifyBusy(false)
              }
            }}
            className="w-full text-center text-xs text-gray-500 hover:text-white disabled:opacity-50"
          >
            OTP yenidən göndər
          </button>
          <button
            type="button"
            onClick={() => {
              setVerifyStep('phone')
              setVerifyCode('')
            }}
            className="w-full text-center text-xs text-gray-500 hover:text-white"
          >
            ← Geri
          </button>
        </form>
  