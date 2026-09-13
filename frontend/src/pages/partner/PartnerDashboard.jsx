import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import Button from '../../components/common/Button'
import Brand from '../../components/common/Brand'
import LocaleThemeBar from '../../components/LocaleThemeBar'
import { useToast } from '../../components/common/Toast'
import useAuthStore from '../../hooks/useAuth'
import useUiStore from '../../hooks/useUi'
import PersonaSettingsCard from '../../components/onboarding/PersonaSettingsCard'
import { allowRolePanelVisit, secondaryPanelPathForUser } from '../../lib/postAuth'

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
      <header className="border-b border-[color:var(--border-subtle)] px-4 py-3 flex items-center justify-between gap-3">
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

export default function PartnerDashboard() {
  const { t } = useTranslation()
  const toast = useToast()
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [applying, setApplying] = useState(false)
  const [payoutBusy, setPayoutBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
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
      const dash = await api.get('/partner/dashboard')
      setData(dash)
    } catch (e) {
      if (e?.response?.status === 404) setData({ needApply: true })
      else toast.error(e?.message || t('partner.loadError'))
    } finally {
      setLoading(false)
    }
  }, [t, toast])

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

  if (loading) {
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

  return (
    <PartnerShell>
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-8">
      <header>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-token-textMain">{t('partner.title')}</h1>
        <p className="mt-1 text-sm text-token-textMuted">
          {partner.campaign_title || t('partner.defaultCampaign')}
        </p>
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
        <p className="mt-3 text-xs text-token-textMuted">
          {t('partner.terms', {
            discount: partner.user_discount_pct ?? 10,
            commission: partner.commission_pct ?? 20,
            months: partner.commission_duration_months ?? 3,
            trial: partner.trial_days ?? 21,
          })}
        </p>
        <p className="mt-1 text-[11px] leading-snug text-token-textMuted/90" title={t('partner.termsTooltip')}>
          {t('partner.termsHint', {
            months: partner.commission_duration_months ?? 3,
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

      <section className="flex flex-wrap items-center gap-3">
        <Button onClick={requestPayout} disabled={payoutBusy || !(stats.approved_cents > 0)}>
          {payoutBusy ? t('common.loading') : t('partner.requestPayout')}
        </Button>
        <span className="text-xs text-token-textMuted">
          {t('partner.minPayout', { amount: centsToAzn(partner.minimum_payout_cents ?? 2000) })}
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
