import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../lib/api'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'

function centsToAzn(cents) {
  return (Math.round(Number(cents) || 0) / 100).toFixed(2)
}

export default function AdminPartners() {
  const toast = useToast()
  const [tab, setTab] = useState('partners')
  const [partners, setPartners] = useState([])
  const [payouts, setPayouts] = useState([])
  const [commissions, setCommissions] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [p, po, c, camp] = await Promise.all([
        api.get('/admin/partners', { params: statusFilter ? { status: statusFilter } : {} }),
        api.get('/admin/partner-payouts'),
        api.get('/admin/partner-commissions', { params: { limit: 80 } }),
        api.get('/admin/partner-campaigns'),
      ])
      setPartners(Array.isArray(p?.partners) ? p.partners : [])
      setPayouts(Array.isArray(po?.payouts) ? po.payouts : [])
      setCommissions(Array.isArray(c?.commissions) ? c.commissions : [])
      setCampaigns(Array.isArray(camp?.campaigns) ? camp.campaigns : [])
    } catch (e) {
      toast.error(e?.message || 'Yüklənmədi')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, toast])

  useEffect(() => {
    load()
  }, [load])

  async function setPartnerStatus(id, status) {
    setBusy(id)
    try {
      await api.post(`/admin/partners/${id}/status`, { status })
      toast.success(`Status: ${status}`)
      await load()
    } catch (e) {
      toast.error(e?.message || 'Xəta')
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
      toast.error(e?.message || 'Xəta')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-token-textMain">Partner proqramı</h1>
          <p className="text-sm text-token-textMuted">Müraciətlər, komissiyalar və payout-lar</p>
        </div>
        <Link to="/admin/billing" className="text-sm text-token-accent underline">
          Platform ödənişləri
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          ['partners', 'Partnerlər'],
          ['commissions', 'Komissiyalar'],
          ['payouts', 'Payout'],
          ['campaigns', 'Kampaniyalar'],
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
        <p className="text-token-textMuted">Yüklənir…</p>
      ) : tab === 'partners' ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <select
              className="rounded-lg border border-token-border bg-token-bg px-2 py-1.5 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Hamısı</option>
              <option value="pending">pending</option>
              <option value="approved">approved</option>
              <option value="rejected">rejected</option>
              <option value="suspended">suspended</option>
            </select>
            <Button variant="secondary" onClick={load}>
              Yenilə
            </Button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-token-border">
            <table className="min-w-full text-sm">
              <thead className="bg-token-bg text-left text-token-textMuted">
                <tr>
                  <th className="px-3 py-2">Ad</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Attr.</th>
                  <th className="px-3 py-2">Komissiya</th>
                  <th className="px-3 py-2">Əməliyyat</th>
                </tr>
              </thead>
              <tbody>
                {partners.map((p) => (
                  <tr key={p.id} className="border-t border-token-border">
                    <td className="px-3 py-2">{p.display_name || p.full_name}</td>
                    <td className="px-3 py-2 text-token-textMuted">{p.email}</td>
                    <td className="px-3 py-2">{p.status}</td>
                    <td className="px-3 py-2">{p.attributions_count ?? 0}</td>
                    <td className="px-3 py-2">{centsToAzn(p.commission_pending_cents)} AZN</td>
                    <td className="px-3 py-2 space-x-1">
                      {p.status === 'pending' && (
                        <>
                          <Button size="sm" disabled={busy === p.id} onClick={() => setPartnerStatus(p.id, 'approved')}>
                            Təsdiq
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busy === p.id}
                            onClick={() => setPartnerStatus(p.id, 'rejected')}
                          >
                            Rədd
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
                          Bərpa
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
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
                <th className="px-3 py-2">Məbləğ</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Əməliyyat</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.id} className="border-t border-token-border">
                  <td className="px-3 py-2">{p.display_name || p.full_name || p.email}</td>
                  <td className="px-3 py-2">{centsToAzn(p.amount_cents)} AZN</td>
                  <td className="px-3 py-2">{p.status}</td>
                  <td className="px-3 py-2 space-x-1">
                    {p.status === 'pending' && (
                      <>
                        <Button size="sm" disabled={busy === p.id} onClick={() => reviewPayout(p.id, 'approved')}>
                          Təsdiq
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busy === p.id}
                          onClick={() => reviewPayout(p.id, 'rejected')}
                        >
                          Rədd
                        </Button>
                      </>
                    )}
                    {p.status === 'approved' && (
                      <Button size="sm" disabled={busy === p.id} onClick={() => reviewPayout(p.id, 'paid')}>
                        Ödənildi
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
                {c.commission_pct}% × {c.commission_duration_months}ay · Window {c.attribution_window_days}g · Min payout{' '}
                {centsToAzn(c.minimum_payout_cents)} AZN
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
