import { useCallback, useEffect, useState } from 'react'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'

const STATUS_LABEL = {
  pending: 'Gözləyir',
  paid: 'Ödənilib',
  rejected: 'Rədd edilib',
  failed: 'Uğursuz',
  expired: 'Vaxtı bitib',
}

function statusCls(st) {
  const s = String(st || '').toLowerCase()
  if (s === 'paid') return 'bg-emerald-500/20 text-emerald-400'
  if (s === 'pending') return 'bg-amber-500/20 text-amber-300'
  if (s === 'rejected') return 'bg-rose-500/20 text-rose-300'
  return 'bg-gray-500/20 text-gray-400'
}

export default function AdminBilling() {
  const toast = useToast()
  const [tab, setTab] = useState('pending')
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [settings, setSettings] = useState({ manual_transfer_account: '', sms_packs: [] })
  const [accountDraft, setAccountDraft] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)

  const loadPayments = useCallback(async () => {
    setLoading(true)
    try {
      const q = tab === 'pending' ? '?status=pending&payment_method=cash&limit=100' : '?limit=100'
      const d = await api.get(`/admin/billing/payments${q}`)
      setPayments(d.payments || [])
    } catch (e) {
      toast(e?.message || 'Yüklənmədi', 'error')
    } finally {
      setLoading(false)
    }
  }, [tab, toast])

  const loadSettings = useCallback(async () => {
    try {
      const d = await api.get('/admin/billing/settings')
      const s = d.settings || d
      setSettings(s)
      setAccountDraft(s.manual_transfer_account || '')
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    void loadPayments()
  }, [loadPayments])

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  async function approve(id) {
    setBusyId(id)
    try {
      await api.post(`/admin/billing/payments/${id}/approve`)
      toast('Ödəniş təsdiqləndi və aktivləşdirildi')
      await loadPayments()
    } catch (e) {
      toast(e?.message || 'Xəta', 'error')
    } finally {
      setBusyId(null)
    }
  }

  async function reject(id) {
    const note = window.prompt('Rədd səbəbi (istəyə bağlı):') || ''
    setBusyId(id)
    try {
      await api.post(`/admin/billing/payments/${id}/reject`, { admin_note: note })
      toast('Ödəniş rədd edildi')
      await loadPayments()
    } catch (e) {
      toast(e?.message || 'Xəta', 'error')
    } finally {
      setBusyId(null)
    }
  }

  async function saveSettings() {
    setSavingSettings(true)
    try {
      const d = await api.put('/admin/billing/settings', { manual_transfer_account: accountDraft })
      setSettings(d.settings || d)
      toast('Hesab nömrəsi saxlanıldı')
    } catch (e) {
      toast(e?.message || 'Xəta', 'error')
    } finally {
      setSavingSettings(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl">Platform ödənişləri</h1>
        <p className="text-gray-400 text-sm mt-1">Köçürmə (nağd) təsdiqləri və ödəniş tarixçəsi</p>
      </div>

      <Card className="p-5">
        <h2 className="font-display font-bold text-sm mb-3">Köçürmə hesabı (12 rəqəm)</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            className="flex-1 bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm font-mono tracking-wider"
            value={accountDraft}
            maxLength={12}
            inputMode="numeric"
            onChange={(e) => setAccountDraft(e.target.value.replace(/\D/g, '').slice(0, 12))}
            placeholder="000000000000"
          />
          <Button loading={savingSettings} onClick={() => void saveSettings()} className="shrink-0">
            Saxla
          </Button>
        </div>
        <p className="text-xs text-gray-500 mt-2">Müəllimlər nağd ödəniş seçəndə bu nömrə göstərilir.</p>
      </Card>

      <div className="flex gap-2">
        {[
          ['pending', 'Gözləyən köçürmələr'],
          ['all', 'Bütün ödənişlər'],
        ].map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={[
              'px-4 py-2 rounded-xl text-sm font-semibold border transition-colors',
              tab === k
                ? 'border-primary/40 bg-primary/10 text-white'
                : 'border-indigo-500/20 text-gray-400 hover:text-white',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Yüklənir…</div>
        ) : !payments.length ? (
          <div className="p-8 text-center text-gray-500">Ödəniş tapılmadı</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-indigo-500/20 text-gray-400 text-xs uppercase">
                  {['Müəllim', 'Məhsul', 'Məbləğ', 'Üsul', 'Status', 'Tarix', 'Əməliyyat'].map((h) => (
                    <th key={h} className="py-3 px-4 text-left font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-indigo-500/10 hover:bg-indigo-500/5">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{p.full_name || '—'}</div>
                      <div className="text-xs text-gray-500">{p.email}</div>
                    </td>
                    <td className="py-3 px-4 text-gray-300">
                      {p.product_type === 'sms'
                        ? `+${p.sms_quantity || 0} SMS`
                        : String(p.plan || '').toUpperCase()}
                      {p.billing_interval ? (
                        <span className="text-gray-500 text-xs ml-1">({p.billing_interval})</span>
                      ) : null}
                    </td>
                    <td className="py-3 px-4 font-semibold text-white">
                      {(Number(p.amount_cents || 0) / 100).toFixed(2)} ₼
                    </td>
                    <td className="py-3 px-4 text-gray-400 text-xs">
                      {p.payment_method === 'cash' ? 'Köçürmə' : 'Kart'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${statusCls(p.status)}`}>
                        {STATUS_LABEL[p.status] || p.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-500">
                      {p.created_at ? new Date(p.created_at).toLocaleString('az-AZ') : '—'}
                    </td>
                    <td className="py-3 px-4">
                      {p.status === 'pending' && p.payment_method === 'cash' ? (
                        <div className="flex gap-2">
                          <Button size="sm" loading={busyId === p.id} onClick={() => void approve(p.id)}>
                            Təsdiq
                          </Button>
                          <Button size="sm" variant="danger" disabled={busyId === p.id} onClick={() => void reject(p.id)}>
                            Rədd
                          </Button>
                        </div>
                      ) : (
                        <span className="text-gray-600 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
