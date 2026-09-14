import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import api from '../../lib/api'
import Button from '../../components/common/Button'
import Brand from '../../components/common/Brand'
import LocaleThemeBar from '../../components/LocaleThemeBar'
import { useToast } from '../../components/common/Toast'
import useAuthStore from '../../hooks/useAuth'
import useUiStore from '../../hooks/useUi'
import PersonaSettingsCard from '../../components/onboarding/PersonaSettingsCard'
import { allowRolePanelVisit, secondaryPanelPathForUser } from '../../lib/postAuth'
import { STICKY_TOP_BAR } from '../../lib/stickyTopBar'

function centsToAzn(cents) {
  return (Math.round(Number(cents) || 0) / 100).toFixed(2)
}

function statusBadge(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'approved' || s === 'paid') return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
  if (s === 'pending') return 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
  if (s === 'rejected' || s === 'suspended' || s === 'void') return 'bg-rose-500/15 text-rose-600 dark:text-rose-300'
  return 'bg-token-border/40 text-token-textMuted'
}

const PERIODS = ['7d', '30d', 'year', 'all']
const ANALYTICS_TABS = ['timeline', 'sources', 'funnel']

function PartnerChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-[color:var(--border-subtle)] bg-token-surfaceCard px-3 py-2 text-xs shadow-xl">
      <div className="text-token-textMuted mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey || p.name} className="text-token-textMain font-medium tabular-nums">
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  )
}

function PartnerShell({ children }) {
  const { t } = useTranslation()
  const { user, logout } = useAuthStore()
  const { theme } = useUiStore()
  const secondaryHome = secondaryPanelPathForUser(user) || '/'
  const initials = String(user?.full_name || '')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
  return (
    <div className={`theme-${theme} min-h-screen bg-token-surfaceMain text-token-textMain`}>
      <header
        className={[
          STICKY_TOP_BAR,
          'px-4 py-3 flex items-center justify-between gap-3',
        ].join(' ')}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/partner/dashboard" className="shrink-0">
            <Brand size="nav" tone={theme === 'dark' ? 'dark' : 'light'} />
          </Link>
          <div className="hidden sm:flex items-center gap-2 min-w-0">
            <div
              className={[
                'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border shrink-0',
                theme === 'dark'
                  ? 'bg-white/5 border-white/10 text-white'
                  : 'bg-slate-900/5 border-black/[0.06] text-slate-900',
              ].join(' ')}
            >
              {initials || 'P'}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{user?.full_name || '—'}</div>
              <div className="text-xs text-token-textMuted">
                {t('layout.partnerRole', { defaultValue: 'Partner' })}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 text-sm flex-wrap justify-end">
          <Link to="/" className="text-token-textMuted hover:text-token-textMain whitespace-nowrap">
            {t('auth.backHome')}
          </Link>
          <Link to="/partner" className="text-token-textMuted hover:text-token-textMain whitespace-nowrap hidden sm:inline">
            {t('partner.public.nav', { defaultValue: 'Partner proqramı' })}
          </Link>
          <Link
            to={secondaryHome}
            onClick={() => allowRolePanelVisit()}
            className="rounded-lg bg-primary/15 border border-primary/30 px-3 py-1.5 font-semibold text-primary whitespace-nowrap"
          >
            {t('partner.secondaryPanel', { defaultValue: 'Digər panel' })}
          </Link>
          <LocaleThemeBar tone={theme === 'dark' ? 'dark' : 'light'} />
          <button
            type="button"
            onClick={() => logout()}
            className="rounded-lg border border-token-border px-3 py-1.5 text-token-textMuted hover:text-token-textMain hover:bg-token-bg whitespace-nowrap"
          >
            {t('layout.logout')}
          </button>
        </div>
      </header>
      {children}
    </div>
  )
}

function PartnerAnalyticsPanel({ analytics, period, onPeriodChange, theme }) {
  const { t } = useTranslation()
  const [tab, setTab] = useState('timeline')
  const axisTick = theme === 'dark' ? '#94a3b8' : '#64748b'
  const gridStroke = theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.08)'

  const series = useMemo(() => {
    return (analytics?.time_series || []).map((row) => ({
      ...row,
      earnings: Number(((Number(row.earnings_cents) || 0) / 100).toFixed(2)),
    }))
  }, [analytics?.time_series])

  const sources = analytics?.sources || []
  const funnel = analytics?.funnel || {}
  const hasSeriesActivity = series.some((r) => (r.clicks || 0) > 0 || (r.earnings || 0) > 0)
  const hasSources = sources.some((s) => (s.clicks || 0) > 0)
  const funnelSteps = [
    { key: 'clicks', label: t('partner.analytics.funnelClicks'), value: funnel.clicks ?? 0 },
    { key: 'signups', label: t('partner.analytics.funnelSignups'), value: funnel.signups ?? 0 },
    { key: 'paid', label: t('partner.analytics.funnelPaid'), value: funnel.paid_customers ?? 0 },
    {
      key: 'earnings',
      label: t('partner.analytics.funnelEarnings'),
      value: `${centsToAzn(funnel.earnings_cents)} AZN`,
    },
  ]
  const maxFunnel = Math.max(1, ...funnelSteps.slice(0, 3).map((s) => Number(s.value) || 0))

  return (
    <section className="rounded-2xl border border-token-border bg-token-surface/40 p-4 sm:p-5 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-semibold text-token-textMain">{t('partner.analytics.title')}</h2>
        <div className="flex flex-wrap gap-1.5">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPeriodChange(p)}
              className={[
                'rounded-lg px-2.5 py-1 text-xs font-semibold border transition-colors',
                period === p
                  ? 'bg-primary/15 border-primary/40 text-primary'
                  : 'border-token-border text-token-textMuted hover:text-token-textMain hover:bg-token-bg',
              ].join(' ')}
            >
              {t(`partner.analytics.period.${p}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-token-border pb-2">
        {ANALYTICS_TABS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={[
              'rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
              tab === id
                ? 'bg-token-bg text-token-textMain'
                : 'text-token-textMuted hover:text-token-textMain',
            ].join(' ')}
          >
            {t(`partner.analytics.tabs.${id}`)}
          </button>
        ))}
      </div>

      {tab === 'timeline' ? (
        hasSeriesActivity ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="partnerClicksGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22e088" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#22e088" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={gridStroke} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: axisTick, fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={20}
                />
                <YAxis
                  yAxisId="clicks"
                  tick={{ fill: axisTick, fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={32}
                />
                <YAxis
                  yAxisId="earn"
                  orientation="right"
                  tick={{ fill: axisTick, fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip content={<PartnerChartTooltip />} />
                <Area
                  yAxisId="clicks"
                  type="monotone"
                  dataKey="clicks"
                  name={t('partner.analytics.seriesClicks')}
                  stroke="#22e088"
                  fill="url(#partnerClicksGrad)"
                  strokeWidth={2}
                />
                <Area
                  yAxisId="earn"
                  type="monotone"
                  dataKey="earnings"
                  name={t('partner.analytics.seriesEarnings')}
                  stroke="#6366f1"
                  fill="none"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-token-textMuted">{t('partner.analytics.emptyTimeline')}</p>
        )
      ) : null}

      {tab === 'sources' ? (
        hasSources ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sources} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
                <CartesianGrid stroke={gridStroke} horizontal={false} />
                <XAxis type="number" tick={{ fill: axisTick, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={88}
                  tick={{ fill: axisTick, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<PartnerChartTooltip />} />
                <Bar
                  dataKey="clicks"
                  name={t('partner.analytics.seriesClicks')}
                  fill="#22e088"
                  radius={[0, 6, 6, 0]}
                  barSize={18}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-token-textMuted">{t('partner.analytics.emptySources')}</p>
        )
      ) : null}

      {tab === 'funnel' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {funnelSteps.map((step) => (
              <div key={step.key} className="rounded-xl border border-token-border bg-token-bg/50 p-3">
                <div className="text-[11px] text-token-textMuted">{step.label}</div>
                <div className="mt-1 text-base font-semibold text-token-textMain tabular-nums">{step.value}</div>
                {step.key !== 'earnings' ? (
                  <div
                    className="mt-2 h-1.5 rounded-full bg-token-border/50 overflow-hidden"
                    aria-hidden
                  >
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.max(4, ((Number(step.value) || 0) / maxFunnel) * 100)}%` }}
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="rounded-xl border border-token-border px-3 py-2">
              <span className="text-token-textMuted">{t('partner.analytics.clickToSignup')}: </span>
              <span className="font-semibold text-token-textMain tabular-nums">
                {funnel.click_to_signup_pct ?? 0}%
              </span>
            </div>
            <div className="rounded-xl border border-token-border px-3 py-2">
              <span className="text-token-textMuted">{t('partner.analytics.signupToPaid')}: </span>
              <span className="font-semibold text-token-textMain tabular-nums">
                {funnel.signup_to_paid_pct ?? 0}%
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default function PartnerDashboard() {
  const { t } = useTranslation()
  const toast = useToast()
  const { user } = useAuthStore()
  const { theme } = useUiStore()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [applying, setApplying] = useState(false)
  const [payoutBusy, setPayoutBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [period, setPeriod] = useState('30d')

  const load = useCallback(async (periodOverride) => {
    const p = periodOverride || period
    setLoading(true)
    try {
      const st = await api.get('/partner/status')
      if (!st?.enabled) {
        setData({ disabled: true })
        return
      }
      if (!st?.partner) {
        setData({ needApply: true })
        return
      }
      if (st.partner.status !== 'approved') {
        setData({ pending: true, partner: st.partner })
        return
      }
      const dash = await api.get('/partner/dashboard', { params: { period: p } })
      setData(dash)
    } catch (e) {
      if (e?.response?.status === 404) setData({ needApply: true })
      else toast.error(e?.message || t('partner.loadError'))
    } finally {
      setLoading(false)
    }
  }, [period, t, toast])

  useEffect(() => {
    load()
  }, [load])

  const primaryLink = useMemo(() => data?.links?.[0] || null, [data])
  const shareUrl = useMemo(() => {
    if (!primaryLink?.code) return ''
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return `${origin}/r/${primaryLink.code}`
  }, [primaryLink])

  async function handleApply() {
    setApplying(true)
    try {
      await api.post('/partner/apply', {
        display_name: user?.full_name,
        phone: user?.phone,
      })
      toast.success(t('partner.applyOk'))
      await load()
    } catch (e) {
      toast.error(e?.message || t('partner.applyError'))
    } finally {
      setApplying(false)
    }
  }

  async function copyLink() {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      toast.success(t('partner.copied'))
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(t('partner.copyError'))
    }
  }

  async function requestPayout() {
    setPayoutBusy(true)
    try {
      await api.post('/partner/payouts/request')
      toast.success(t('partner.payoutRequested'))
      await load()
    } catch (e) {
      toast.error(e?.message || t('partner.payoutError'))
    } finally {
      setPayoutBusy(false)
    }
  }

  function handlePeriodChange(next) {
    setPeriod(next)
  }

  if (loading && !data) {
    return (
      <PartnerShell>
        <div className="mx-auto max-w-4xl px-4 py-10 text-token-textMuted">{t('common.loading')}</div>
      </PartnerShell>
    )
  }

  if (data?.disabled) {
    return (
      <PartnerShell>
        <div className="mx-auto max-w-4xl px-4 py-10">
          <h1 className="font-display text-2xl font-bold text-token-textMain">{t('partner.title')}</h1>
          <p className="mt-2 text-token-textMuted">{t('partner.disabled')}</p>
        </div>
      </PartnerShell>
    )
  }

  if (data?.needApply) {
    return (
      <PartnerShell>
        <div className="mx-auto max-w-4xl px-4 py-10 space-y-6">
          <div>
            <h1 className="font-display text-2xl font-bold text-token-textMain">{t('partner.title')}</h1>
            <p className="mt-3 max-w-xl text-token-textMuted">{t('partner.applyDesc')}</p>
            <Button className="mt-6" onClick={handleApply} disabled={applying}>
              {applying ? t('common.loading') : t('partner.applyCta')}
            </Button>
          </div>
          <PersonaSettingsCard />
        </div>
      </PartnerShell>
    )
  }

  if (data?.pending) {
    return (
      <PartnerShell>
        <div className="mx-auto max-w-4xl px-4 py-10 space-y-6">
          <div>
            <h1 className="font-display text-2xl font-bold text-token-textMain">{t('partner.title')}</h1>
            <p className="mt-3 text-token-textMuted">{t('partner.pendingReview')}</p>
            <span className={`mt-4 inline-flex rounded-full px-3 py-1 text-sm ${statusBadge(data.partner?.status)}`}>
              {data.partner?.status}
            </span>
          </div>
          <PersonaSettingsCard />
        </div>
      </PartnerShell>
    )
  }

  const stats = data?.stats || {}
  const partner = data?.partner || {}
  const discountMonths = partner.discount_duration_months ?? 3
  const commissionMonths = partner.commission_duration_months
  const campaignSlug = String(partner.campaign_slug || '').trim()
  const campaignI18nKey =
    campaignSlug === 'mentorix-partner-launch'
      ? 'partner.campaigns.mentorixPartnerLaunch'
      : null
  const campaignTitle = campaignI18nKey
    ? t(campaignI18nKey, {
        defaultValue: partner.campaign_title || t('partner.defaultCampaign'),
      })
    : partner.campaign_title || t('partner.defaultCampaign')

  return (
    <PartnerShell>
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-8">
      <header>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-token-textMain">{t('partner.title')}</h1>
        <p className="mt-1 text-sm text-token-textMuted">{campaignTitle}</p>
      </header>

      <PersonaSettingsCard />

      <section className="rounded-2xl border border-token-border bg-token-surface/60 p-5 sm:p-6">
        <h2 className="font-semibold text-token-textMain">{t('partner.yourLink')}</h2>
        <p className="mt-1 text-sm text-token-textMuted">{t('partner.linkHint')}</p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <code className="flex-1 break-all rounded-xl bg-token-bg px-3 py-2 text-sm text-token-textMain">
            {shareUrl || '—'}
          </code>
          <Button onClick={copyLink} disabled={!shareUrl}>
            {copied ? t('partner.copied') : t('partner.copyLink')}
          </Button>
        </div>
        <p
          className="mt-3 text-sm leading-relaxed text-token-textMain/80"
          title={t('partner.termsTooltip', { discountMonths })}
        >
          {Number(commissionMonths) > 0
            ? t('partner.termsLimited', {
                discount: partner.user_discount_pct ?? 10,
                discountMonths,
                commission: partner.commission_pct ?? 20,
                commissionMonths,
                trial: partner.trial_days ?? 21,
              })
            : t('partner.terms', {
                discount: partner.user_discount_pct ?? 10,
                discountMonths,
                commission: partner.commission_pct ?? 20,
                trial: partner.trial_days ?? 21,
              })}
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: t('partner.stats.clicks'), value: stats.clicks ?? 0 },
          { label: t('partner.stats.attributions'), value: stats.attributions ?? 0 },
          { label: t('partner.stats.approved'), value: `${centsToAzn(stats.approved_cents)} AZN` },
          { label: t('partner.stats.paid'), value: `${centsToAzn(stats.paid_cents)} AZN` },
        ].map((x) => (
          <div key={x.label} className="rounded-2xl border border-token-border bg-token-surface/40 p-4">
            <div className="text-xs text-token-textMuted">{x.label}</div>
            <div className="mt-1 text-lg font-semibold text-token-textMain">{x.value}</div>
          </div>
        ))}
      </section>

      <PartnerAnalyticsPanel
        analytics={data?.analytics}
        period={period}
        onPeriodChange={handlePeriodChange}
        theme={theme}
      />

      <section className="flex flex-wrap items-center gap-3">
        <Button onClick={requestPayout} disabled={payoutBusy || !(stats.approved_cents > 0)}>
          {payoutBusy ? t('common.loading') : t('partner.requestPayout')}
        </Button>
        <span className="text-xs text-token-textMuted">
          {t('partner.minPayout', { amount: centsToAzn(partner.minimum_payout_cents ?? 500) })}
        </span>
      </section>

      <section>
        <h2 className="mb-3 font-semibold text-token-textMain">{t('partner.commissions')}</h2>
        <div className="overflow-x-auto rounded-2xl border border-token-border">
          <table className="min-w-full text-sm">
            <thead className="bg-token-bg/80 text-left text-token-textMuted">
              <tr>
                <th className="px-3 py-2">{t('partner.col.plan')}</th>
                <th className="px-3 py-2">{t('partner.col.period')}</th>
                <th className="px-3 py-2">{t('partner.col.amount')}</th>
                <th className="px-3 py-2">{t('partner.col.status')}</th>
              </tr>
            </thead>
            <tbody>
              {(data?.commissions || []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-token-textMuted">
                    {t('partner.noCommissions')}
                  </td>
                </tr>
              ) : (
                data.commissions.map((c) => (
                  <tr key={c.id} className="border-t border-token-border">
                    <td className="px-3 py-2 text-token-textMain">{c.plan || '—'}</td>
                    <td className="px-3 py-2 text-token-textMuted">#{c.period_index}</td>
                    <td className="px-3 py-2 text-token-textMain">{centsToAzn(c.commission_cents)} AZN</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${statusBadge(c.status)}`}>
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-semibold text-token-textMain">{t('partner.payouts')}</h2>
        <div className="overflow-x-auto rounded-2xl border border-token-border">
          <table className="min-w-full text-sm">
            <thead className="bg-token-bg/80 text-left text-token-textMuted">
              <tr>
                <th className="px-3 py-2">{t('partner.col.amount')}</th>
                <th className="px-3 py-2">{t('partner.col.status')}</th>
                <th className="px-3 py-2">{t('partner.col.date')}</th>
              </tr>
            </thead>
            <tbody>
              {(data?.payouts || []).length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-token-textMuted">
                    {t('partner.noPayouts')}
                  </td>
                </tr>
              ) : (
                data.payouts.map((p) => (
                  <tr key={p.id} className="border-t border-token-border">
                    <td className="px-3 py-2">{centsToAzn(p.amount_cents)} AZN</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${statusBadge(p.status)}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-token-textMuted">
                      {p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
    </PartnerShell>
  )
}
