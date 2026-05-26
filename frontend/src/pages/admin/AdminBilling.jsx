import { useCallback, useEffect, useState } from 'react'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'
import { billingPaymentStatusLabel } from '../../lib/billingPaymentLabels'

const STATUS_LABEL = {
  pending: 'Gözləyir',
  paid: 'Ödənilib',
  rejected: 'Rədd edilib',
  failed: 'Uğursuz',
  expired: 'Tamamlanmayıb',
}

function statusCls(st) {
  const s = String(st || '').toLowerCase()
  if (s === 'paid') return 'bg-emerald-500/20 text-emerald-400'
  if (s === 'pending') return 'bg-amber-500/20 text-amber-300'
  if (s === 'rejected') return 'bg-rose-500/20 text-rose-300'
  return 'bg-gray-500/20 text-gray-400'
}

function emptyPack() {
  return { quantity: '', price_azn: '', label: '' }
}

export default function AdminBilling() {
  const toast = useToast()
  const [tab, setTab] = useState('pending')
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [accountDraft, setAccountDraft] = useState('')
  const [smsPacksDraft, setSmsPacksDraft] = useState([emptyPack(), emptyPack(), emptyPack()])
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
      setAccountDraft(s.manual_transfer_account || '')
      const packs = Array.isArray(s.sms_packs) && s.sms_packs.length ? s.sms_packs : []
      setSmsPacksDraft(
        packs.length
          ? packs.map((p) => ({
              quantity: String(p.quantity ?? ''),
              price_azn: String(p.price_azn ?? ''),
              label: String(p.label || ''),
            }))
          : [emptyPack(), emptyPack(), emptyPack()],
      )
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

  function patchPack(idx, field, value) {
    setSmsPacksDraft((rows) => rows.map((r, i) => (i === idx ? { ...r, [field]: value } : r)))
  }

  function addPackRow() {
    setSmsPacksDraft((rows) => [...rows, emptyPack()])
  }

  function removePackRow(idx) {
    setSmsPacksDraft((rows) => (rows.length <= 1 ? rows : rows.filter((_, i) => i !== idx)))
  }

  async function saveSettings() {
    setSavingSettings(true)
    try {
      const sms_packs = smsPacksDraft
        .map((p) => {
          const quantity = Math.round(Number(p.quantity) || 0)
          const price_azn = Number(p.price_azn) || 0
          const label = String(p.label || '').trim() || `${quantity} SMS`
          return { quantity, price_azn, label }
        })
        .filter((p) => p.quantity > 0 && p.price_azn > 0)

      if (!sms_packs.length) {
        toast('Ən azı bir SMS paketi doldurun', 'error')
        return
      }

      const d = await api.put('/admin/billing/settings', {
        manual_transfer_account: accountDraft,
        sms_packs,
      })
      const s = d.settings || d
      setAccountDraft(s.manual_transfer_account || accountDraft)
      if (Array.isArray(s.sms_packs)) {
        setSmsPacksDraft(
          s.sms_packs.map((p) => ({
            quantity: String(p.quantity),
            price_azn: String(p.price_azn),
            label: String(p.label || ''),
          })),
        )
      }
      toast('Ödəniş tənzimləmələri saxlanıldı')
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
        <p className="text-gray-400 text-sm mt-1">
          Köçürmə hesabı, əlavə SMS paketləri, manual təsdiqlər
        </p>
      </div>

      <Card className="p-5 space-y-6">
        <div>
          <h2 className="font-display font-bold text-sm mb-3">Köçürmə hesabı (12 rəqəm)</h2>
          <input
            className="w-full max-w-md bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm font-mono tracking-wider"
            value={accountDraft}
            maxLength={12}
            inputMode="numeric"
            onChange={(e) => setAccountDraft(e.target.value.replace(/\D/g, '').slice(0, 12))}
            placeholder="000000000000"
          />
          <p className="text-xs text-gray-500 mt-2">Müəllim nağd/köçürmə seçəndə bu nömrə göstərilir.</p>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="font-display font-bold text-sm">Əlavə SMS paketləri</h2>
            <Button type="button" size="sm" variant="secondary" onClick={addPackRow}>
              + Paket
            </Button>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Müəllim Tənzimləmələr → «Əlavə SMS al» bölməsində bu paketlər görünür.
          </p>
          <div className="space-y-3">
            {smsPacksDraft.map((p, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1.2fr_auto] gap-2 items-end rounded-xl border border-indigo-500/15 p-3"
              >
                <label className="block text-xs text-gray-400">
                  SMS sayı
                  <input
                    type="number"
                    min={1}
                    className="mt-1 w-full bg-[#13112e] border border-indigo-500/20 rounded-lg px-3 py-2 text-white text-sm"
                    value={p.quantity}
                    onChange={(e) => patchPack(idx, 'quantity', e.target.value)}
                  />
                </label>
                <label className="block text-xs text-gray-400">
                  Qiymət (AZN)
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    className="mt-1 w-full bg-[#13112e] border border-indigo-500/20 rounded-lg px-3 py-2 text-white text-sm"
                    value={p.price_azn}
                    onChange={(e) => patchPack(idx, 'price_azn', e.target.value)}
                  />
                </label>
                <label className="block text-xs text-gray-400">
                  Başlıq (boşsa avtomatik)
                  <input
                    type="text"
                    className="mt-1 w-full bg-[#13112e] border border-indigo-500/20 rounded-lg px-3 py-2 text-white text-sm"
                    value={p.label}
                    placeholder="50 SMS"
                    onChange={(e) => patchPack(idx, 'label', e.target.value)}
                  />
                </label>
                <Button
                  type="button"
                  size="sm"
                  variant="danger"
               