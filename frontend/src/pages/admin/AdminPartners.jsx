import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'

function centsToAzn(cents) {
  return (Math.round(Number(cents) || 0) / 100).toFixed(2)
}

function partnerLabel(p) {
  return p?.display_name || p?.full_name || p?.email || p?.id || '—'
}

export default function AdminPartners() {
  const { t } = useTranslation()
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedId = searchParams.get('partner') || ''

  const [tab, setTab] = useState('partners')
  const [partners, setPartners] = useState([])
  const [payouts, setPayouts] = useState([])
  const [commissions, setCommissions] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const selectedPartner = useMemo(
    () => partners.find((p) => String(p.id) === String(selectedId)) || null,
    [partners, selectedId],
  )

  const selectPartner = useCallback(
    (id) => {
      const next = String(id || '').trim()
      if (!next) {
        setSearchParams({})
        return
      }
      setSearchParams({ partner: next })
      setTab('partners')
    },
    [setSearchParams],
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [p, po, c, camp] = await Promise.all([
        api.get('/admin/partners', { params: statusFilter ? { status: statusFilter } : {} }),
        api.get('/admin/partner-payouts'),
        api.get('/admin/partner-commissions', {
          params: {
            limit: 80,
            ...(selectedId ? { partner_id: selectedId } : {}),
          },
        }),
        api.get('/admin/partner-campaigns'),
      ])
      setPartners(Array.isArray(p?.partners) ? p.partners : [])
      setPayouts(Array.isArray(po?.payouts) ? po.payouts : [])
      setCommissions(Array.isArray(c?.commissions) ? c.commissions : [])
      setCampaigns(Array.isArray(camp?.campaigns) ? camp.campaigns : [])
    } catch (e) {
      toast.error(e?.message || t('adminPartners.loadError', { defaultValue: 'Yüklənmədi' }))
    } finally {
      setLoading(false)
    }
  }, [selectedId, statusFilter, t, toast])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      return
    }
    let cancelled = false
    setDetailLoading(true)
    api
      .get(`/admin/partners/${selectedId}`)
      .then((d) => {
        if (!cancelled) setDetail(d)
      })
      .catch((e) => {
        if (!cancelled) {
          setDetail(null)
          toast.error(e?.message || t('adminPartners.detailError', { defaultValue: 'Partner tapılmadı' }))
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedId, t, toast])

  async function setPartnerStatus(id, status) {
    setBusy(id)
    try {
      await api.post(`/admin/partners/${id}/status`, { status })
      toast.success(`${t('adminPartners.status', { defaultValue: 'Status' })}: ${status}`)
      await load()
    } catch (e) {
      toast.error(e?.message || t('adminPartners.error', { defaultValue: 'Xəta' }))
    } finally {
      setBusy(null)
    }
  }

  async function reviewPayout(id, status) {
    setBusy(id)
    try {
      await api.post(`/admin/partner-payouts/${id}/review`, { status })
      toast.success(`Payout: ${status}`)
      await load()
    } catch (e) {
      toast.error(e?.message || t('adminPartners.error', { defaultValue: 'Xəta' }))
    } finally {
      setBusy(null)
    }
  }

  const filteredPayouts = useMemo(() => {
    if (!selectedId) return payouts
    return payouts.filter((p) => String(p.partner_id || p.partnerId || '') === String(selectedId))
  }, [payouts, selectedId])

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-token-textMain">
            {t('adminPartners.title', { defaultValue: 'Partner proqramı' })}
          </h1>
          <p className="text-sm text-token-textMuted">
            {t('adminPartners.subtitle', { defaultValue: 'Partner seçin, müraciətləri və payout-ları idarə edin' })}
          </p>
        </div>
        <Link to="/admin/billing" className="text-sm text-token-accent underline">
          {t('nav.admin.billing', { defaultValue: 'Platform ödənişləri' })}
        </Link>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
        <label className="block flex-1 min-w-[16rem]">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-token-textMuted">
            {t('adminPartners.selectLabel', { defaultValue: 'Partner seçin' })}
          </span>
          <select
            className="w-full rounded-lg border border-token-border bg-token-bg px-3 py-2 text-sm text-token-textMain"
            value={selectedId}
            onChange={(e) => selectPartner(e.target.value)}
          >
            <option value="">{t('adminPartners.selectPlaceholder', { defaultValue: '— Siyahıdan seçin —' })}</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {partnerLabel(p)} · {p.status}
              </option>
            ))}
          </select>
        </label>
        {selectedId ? (
          <Button variant="secondary" onClick={() => selectPartner('')}>
            {t('adminPartners.clearSelection', { defaultValue: 'Seçimi sil' })}
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          ['partners', t('adminPartners.tabs.partners', { defaultValue: 'Partnerlər' })],
          ['commissions', t('adminPartners.tabs.commissions', { defaultValue: 'Komissiyalar' })],
          ['payouts', t('adminPartners.tabs.payouts', { defaultValue: 'Payout' })],
          ['campaigns', t('adminPartners.tabs.campaigns', { defaultValue: 'Kampaniyalar' })],
        ].map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`rounded-full px-3 py-1.5 text-sm ${
              tab === k
                ? 'bg-token-accent text-white'
                : 'bg-token-surface border border-token-border text-token-textMuted'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-token-textMuted">{t('adminPartners.loading', { defaultValue: 'Yüklənir…' })}</p>
      ) : tab === 'partners' ? (
        <div className="space-y-4">
          <div className="flex gap-2">
            <select
              className="rounded-lg border border-token-border bg-token-bg px-2 py-1.5 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">{t('adminPartners.filterAll', { defaultValue: 'Hamısı' })}</option>
              <option value="pending">pending</option>
              <option value="approved">approved</option>
              <option value="rejected">rejected</option>
              <option value="suspended">suspended</option>
            </select>
            <Button variant="secondary" onClick={load}>
              {t('adminPartners.refresh', { defaultValue: 'Yenilə' })}
            </Button>
          </div>

          {(selectedId || detailLoading) && (
            <div className="rounded-xl border border-token-border bg-token-surface/40 p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold text-token-textMain">
                    {t('adminPartners.detailTitle', { defaultValue: 'Seçilmiş partner' })}
                  </h2>
                  <p className="text-sm text-token-textMuted">
                    {partnerLabel(selectedPartner || detail?.partner)}
                    {selectedPartner?.email ? ` · ${selectedPartner.email}` : ''}
                  </p>
                </div>
                {selectedPartner?.status ? (
                  <span className="rounded-full bg-token-border/40 px-2.5 py-1 text-xs font-medium">
                    {selectedPartner.status}
                  </span>
                ) : null}
              </div>

              {detailLoading ? (
                <p className="text-sm text-token-textMuted">{t('adminPartners.loading', { defaultValue: 'Yüklənir…' })}</p>
              ) : detail?.partner ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div>
                      <div className="text-token-textMuted text-xs">{t('partner.stats.clicks', { defaultValue: 'Klik' })}</div>
                      <div className="font-semibold">{detail.stats?.clicks ?? 0}</div>
                    </div>
                    <div>
                      <div className="text-token-textMuted text-xs">
                        {t('partner.stats.attributions', { defaultValue: 'Attribution' })}
                      </div>
                      <div className="font-semibold">{detail.stats?.attributions ?? 0}</div>
                    </div>
                    <div>
                      <div className="text-token-textMuted text-xs">
                        {t('adminPartners.pendingCommission', { defaultValue: 'Gözləyən' })}
                      </div>
                      <div className="font-semibold">{centsToAzn(detail.stats?.pending_cents)} AZN</div>
                    </div>
                    <div>
                      <div className="text-token-textMuted text-xs">
                        {t('partner.stats.approved', { defaultValue: 'Təsdiqli balans' })}
                      </div>
                      <div className="font-semibold">{centsToAzn(detail.stats?.approved_cents)} AZN</div>
                    </div>
                  </div>
                  {Array.isArray(detail.links) && detail.links.length > 0 ? (
                    <div className="text-sm">
                      <div className="text-xs text-token-textMuted mb-1">
                        {t('adminPartners.referralLinks', { defaultValue: 'Referral linklər' })}
                      </div>
                      <ul className="space-y-1">
                        {detail.links.map((l) => (
                          <li key={l.id} className="font-mono text-token-textMain">
                            {l.path || `/r/${l.code}`}
                            {!l.is_active ? ' (off)' : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              ) : null}

              {selectedPartner ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {selectedPartner.status === 'pending' && (
                    <>
                      <Button
                        size="sm"
                        disabled={busy === selectedPartner.id}
                        onClick={() => setPartnerStatus(selectedPartner.id, 'approved')}
                      >
                        {t('adminPartners.approve', { defaultValue: 'Təsdiq' })}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy === selectedPartner.id}
                        onClick={() => setPartnerStatus(selectedPartner.id, 'rejected')}
                      >
                        {t('adminPartners.reject', { defaultValue: 'Rədd' })}
                      </Button>
                    </>
                  )}
                  {selectedPartner.status === 'approved' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy === selectedPartner.id}
                      onClick={() => setPartnerStatus(selectedPartner.id, 'suspended')}
                    >
                      Suspend
                    </Button>
                  )}
                  {selectedPartner.status === 'suspended' && (
                    <Button
                      size="sm"
                      disabled={busy === selectedPartner.id}
                      onClick={() => setPartnerStatus(selectedPartner.id, 'approved')}
                    >
                      {t('adminPartners.restore', { defaultValue: 'Bərpa' })}
                    </Button>
                  )}
                </div>
              ) : null}
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-token-border">
            <table className="min-w-full text-sm">
              <thead className="bg-token-bg text-left text-token-textMuted">
                <tr>
                  <th className="px-3 py-2">{t('adminPartners.col.name', { defaultValue: 'Ad' })}</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">{t('adminPartners.col.status', { defaultValue: 'Status' })}</th>
                  <th className="px-3 py-2">Attr.</th>
                  <th className="px-3 py-2">{t('adminPartners.col.commission', { defaultValue: 'Komissiya' })}</th>
                  <th className="px-3 py-2">{t('adminPartners.col.actions', { defaultValue: 'Əməliyyat' })}</th>
                </tr>
              </thead>
              <tbody>
                {partners.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-token-textMuted">
                      {t('adminPartners.empty', { defaultValue: 'Hələ partner yoxdur' })}
                    </td>
                  </tr>
                ) : (
                  partners.map((p) => {
                    const isSelected = String(p.id) === String(selectedId)
                    return (
                      <tr
                        key={p.id}
                        className={`border-t border-token-border cursor-pointer ${
                          isSelected ? 'bg-token-accent/10' : 'hover:bg-token-surface/60'
                        }`}
                        onClick={() => selectPartner(p.id)}
                      >
                        <td className="px-3 py-2 font-medium text-token-textMain">{partnerLabel(p)}</td>
                        <td className="px-3 py-2 text-token-textMuted">{p.email}</td>
                        <td className="px-3 py-2">{p.status}</td>
                        <td className="px-3 py-2">{p.attributions_count ?? 0}</td>
                        <td className="px-3 py-2">{centsToAzn(p.commission_pending_cents)} AZN</td>
                        <td className="px-3 py-2 space-x-1" onClick={(e) => e.stopPropagation()}>
                          <Button size="sm" variant="secondary" onClick={() => selectPartner(p.id)}>
                            {t('adminPartners.select', { defaultValue: 'Seç' })}
                          </Button>
                          {p.status === 'pending' && (
                            <>
                              <Button size="sm" disabled={busy === p.id} onClick={() => setPartnerStatus(p.id, 'approved')}>
                                {t('adminPartners.approve', { defaultValue: 'Təsdiq' })}
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={busy === p.id}
                                onClick={() => setPartnerStatus(p.id, 'rejected')}
                              >
                                {t('adminPartners.reject', { defaultValue: 'Rədd' })}
                              </Button>
                            </>
                          )}
                          {p.status === 'approved' && (
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={busy === p.id}
                              onClick={() => setPartnerStatus(p.id, 'suspended')}
                            >
                              Suspend
                            </Button>
                          )}
                          {p.status === 'suspended' && (
                            <Button size="sm" disabled={busy === p.id} onClick={() => setPartnerStatus(p.id, 'approved')}>
                              {t('adminPartners.restore', { defaultValue: 'Bərpa' })}
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : tab === 'commissions' ? (
        <div className="overflow-x-auto rounded-xl border border-token-border">
          <table className="min-w-full text-sm">
            <thead className="bg-token-bg text-left text-token-textMuted">
              <tr>
                <th className="px-3 py-2">Invited</th>
                <th className="px-3 py-2">Plan</th>
                <th className="px-3 py-2">Period</th>
                <th className="px-3 py-2">Commission</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {commissions.map((c) => (
                <tr key={c.id} className="border-t border-token-border">
                  <td className="px-3 py-2">{c.invited_email}</td>
                  <td className="px-3 py-2">{c.plan}</td>
                  <td className="px-3 py-2">#{c.period_index}</td>
                  <td className="px-3 py-2">{centsToAzn(c.commission_cents)} AZN</td>
                  <td className="px-3 py-2">{c.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : tab === 'payouts' ? (
        <div className="overflow-x-auto rounded-xl border border-token-border">
          <table className="min-w-full text-sm">
            <thead className="bg-token-bg text-left text-token-textMuted">
              <tr>
                <th className="px-3 py-2">Partner</th>
                <th className="px-3 py-2">{t('partner.col.amount', { defaultValue: 'Məbləğ' })}</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">{t('adminPartners.col.actions', { defaultValue: 'Əməliyyat' })}</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayouts.map((p) => (
                <tr key={p.id} className="border-t border-token-border">
                  <td className="px-3 py-2">{p.display_name || p.full_name || p.email}</td>
                  <td className="px-3 py-2">{centsToAzn(p.amount_cents)} AZN</td>
                  <td className="px-3 py-2">{p.status}</td>
                  <td className="px-3 py-2 space-x-1">
                    {p.status === 'pending' && (
                      <>
                        <Button size="sm" disabled={busy === p.id} onClick={() => reviewPayout(p.id, 'approved')}>
                          {t('adminPartners.approve', { defaultValue: 'Təsdiq' })}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busy === p.id}
                          onClick={() => reviewPayout(p.id, 'rejected')}
                        >
                          {t('adminPartners.reject', { defaultValue: 'Rədd' })}
                        </Button>
                      </>
                    )}
                    {p.status === 'approved' && (
                      <Button size="sm" disabled={busy === p.id} onClick={() => reviewPayout(p.id, 'paid')}>
                        {t('adminPartners.paid', { defaultValue: 'Ödənildi' })}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <div key={c.id} className="rounded-xl border border-token-border bg-token-surface/40 p-4 text-sm">
              <div className="font-semibold text-token-textMain">
                {c.title} {c.is_default ? '(default)' : ''}
              </div>
              <div className="mt-1 text-token-textMuted">
                Trial {c.trial_days}g · Discount {c.user_discount_pct}% × {c.discount_duration_months}ay · Commission{' '}
                {c.commission_pct}% ×{' '}
                {Number(c.commission_duration_months) > 0
                  ? `${c.commission_duration_months}ay`
                  : 'unlimited'}{' '}
                · Window {c.attribution_window_days}g · Min payout{' '}
                {centsToAzn(c.minimum_payout_cents)} AZN
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
