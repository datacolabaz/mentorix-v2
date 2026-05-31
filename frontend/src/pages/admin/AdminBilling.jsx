import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'
import { billingPaymentStatusLabel, BANK_CARD_DIGITS, normalizeBankCardDigits } from '../../lib/billingPaymentLabels'

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

function emptySmsPack() {
  return { quantity: '', price_azn: '', label: '' }
}

function defaultStoragePacksDraft() {
  return [
    {
      quantity_gb: '1',
      quantity_mb: '1024',
      price_azn: '2',
      label: '+1 GB Sənəd Yaddaşı',
      billing_period: 'monthly',
    },
    {
      quantity_gb: '5',
      quantity_mb: '5120',
      price_azn: '6',
      label: '+5 GB Sənəd Yaddaşı',
      billing_period: 'monthly',
    },
    {
      quantity_gb: '15',
      quantity_mb: '15360',
      price_azn: '14',
      label: '+15 GB Sənəd Yaddaşı',
      billing_period: 'monthly',
    },
  ]
}

function storagePackFromApi(p) {
  const mb = Math.round(Number(p.quantity_mb) || 0)
  let quantity_gb = ''
  if (p.quantity_gb != null && p.quantity_gb !== '' && Number.isFinite(Number(p.quantity_gb))) {
    quantity_gb = String(Math.round(Number(p.quantity_gb)))
  } else if (mb >= 1024 && mb % 1024 === 0) {
    quantity_gb = String(mb / 1024)
  } else if (mb > 0) {
    quantity_gb = String(Math.round((mb / 1024) * 100) / 100)
  }
  const quantity_mb =
    mb > 0 ? String(mb) : quantity_gb && Number(quantity_gb) > 0 ? String(Math.round(Number(quantity_gb) * 1024)) : ''
  return {
    quantity_gb,
    quantity_mb,
    price_azn: String(p.price_azn ?? ''),
    label: String(p.label || ''),
    billing_period: String(p.billing_period || 'monthly'),
  }
}

function emptyStoragePack() {
  return { quantity_gb: '', quantity_mb: '', price_azn: '', label: '', billing_period: 'monthly' }
}

function emptyOperatorStock() {
  return {
    operator_sms_stock_remaining: '',
    operator_sms_low_alert: '500',
    operator_storage_mb_remaining: '',
    operator_storage_mb_low_alert: '500',
  }
}

function stockCardCls(low) {
  return low
    ? 'border-rose-500/40 bg-rose-500/10'
    : 'border-emerald-500/25 bg-emerald-500/5'
}

export default function AdminBilling() {
  const toast = useToast()
  const [tab, setTab] = useState('pending')
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [accountDraft, setAccountDraft] = useState('')
  const [smsPacksDraft, setSmsPacksDraft] = useState([emptySmsPack(), emptySmsPack(), emptySmsPack()])
  const [storagePacksDraft, setStoragePacksDraft] = useState(defaultStoragePacksDraft)
  const [operatorDraft, setOperatorDraft] = useState(emptyOperatorStock())
  const [inventory, setInventory] = useState(null)
  const [inventoryLoading, setInventoryLoading] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)
  const [savingStock, setSavingStock] = useState(false)

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
          : [emptySmsPack(), emptySmsPack(), emptySmsPack()],
      )
      const stPacks = Array.isArray(s.storage_packs) && s.storage_packs.length ? s.storage_packs : []
      setStoragePacksDraft(
        stPacks.length
          ? stPacks.map((p) => ({
              quantity_mb: String(p.quantity_mb ?? ''),
              price_azn: String(p.price_azn ?? ''),
              label: String(p.label || ''),
            }))
          : [emptyStoragePack(), emptyStoragePack(), emptyStoragePack()],
      )
      setOperatorDraft({
        operator_sms_stock_remaining: String(s.operator_sms_stock_remaining ?? ''),
        operator_sms_low_alert: String(s.operator_sms_low_alert ?? '500'),
        operator_storage_mb_remaining: String(s.operator_storage_mb_remaining ?? ''),
        operator_storage_mb_low_alert: String(s.operator_storage_mb_low_alert ?? '500'),
      })
    } catch {
      // ignore
    }
  }, [])

  const loadInventory = useCallback(async () => {
    setInventoryLoading(true)
    try {
      const d = await api.get('/admin/billing/inventory')
      setInventory(d.inventory || null)
    } catch (e) {
      toast(e?.message || 'Ehtiyat məlumatı yüklənmədi', 'error')
    } finally {
      setInventoryLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void loadPayments()
  }, [loadPayments])

  useEffect(() => {
    void loadSettings()
    void loadInventory()
  }, [loadSettings, loadInventory])

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
    setSmsPacksDraft((rows) => [...rows, emptySmsPack()])
  }

  function removePackRow(idx) {
    setSmsPacksDraft((rows) => (rows.length <= 1 ? rows : rows.filter((_, i) => i !== idx)))
  }

  function patchStoragePack(idx, field, value) {
    setStoragePacksDraft((rows) =>
      rows.map((r, i) => {
        if (i !== idx) return r
        const next = { ...r, [field]: value }
        if (field === 'quantity_gb') {
          const gb = Number(value)
          next.quantity_mb = Number.isFinite(gb) && gb > 0 ? String(Math.round(gb * 1024)) : ''
        }
        if (field === 'quantity_mb') {
          const mb = Math.round(Number(value) || 0)
          if (mb >= 1024 && mb % 1024 === 0) next.quantity_gb = String(mb / 1024)
        }
        return next
      }),
    )
  }

  function addStoragePackRow() {
    setStoragePacksDraft((rows) => [...rows, emptyStoragePack()])
  }

  function removeStoragePackRow(idx) {
    setStoragePacksDraft((rows) => (rows.length <= 1 ? rows : rows.filter((_, i) => i !== idx)))
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

      const storage_packs = storagePacksDraft
        .map((p) => {
          const quantity_mb = Math.round(Number(p.quantity_mb) || 0)
          const price_azn = Number(p.price_azn) || 0
          const label = String(p.label || '').trim() || `+${quantity_mb} MB yaddaş`
          return { quantity_mb, price_azn, label }
        })
        .filter((p) => p.quantity_mb > 0 && p.price_azn > 0)

      if (!storage_packs.length) {
        toast('Ən azı bir yaddaş paketi doldurun', 'error')
        return
      }

      const d = await api.put('/admin/billing/settings', {
        manual_transfer_account: accountDraft,
        sms_packs,
        storage_packs,
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
      if (Array.isArray(s.storage_packs)) {
        setStoragePacksDraft(s.storage_packs.map(storagePackFromApi))
      }
      toast('Ödəniş tənzimləmələri saxlanıldı')
    } catch (e) {
      toast(e?.message || 'Xəta', 'error')
    } finally {
      setSavingSettings(false)
    }
  }

  async function saveOperatorStock() {
    setSavingStock(true)
    try {
      const payload = {
        operator_sms_stock_remaining: Math.max(0, Math.round(Number(operatorDraft.operator_sms_stock_remaining) || 0)),
        operator_sms_low_alert: Math.max(0, Math.round(Number(operatorDraft.operator_sms_low_alert) || 0)),
        operator_storage_mb_remaining: Math.max(
          0,
          Math.round(Number(operatorDraft.operator_storage_mb_remaining) || 0),
        ),
        operator_storage_mb_low_alert: Math.max(
          0,
          Math.round(Number(operatorDraft.operator_storage_mb_low_alert) || 0),
        ),
      }
      const d = await api.put('/admin/billing/settings', payload)
      const s = d.settings || d
      setOperatorDraft({
        operator_sms_stock_remaining: String(s.operator_sms_stock_remaining ?? payload.operator_sms_stock_remaining),
        operator_sms_low_alert: String(s.operator_sms_low_alert ?? payload.operator_sms_low_alert),
        operator_storage_mb_remaining: String(
          s.operator_storage_mb_remaining ?? payload.operator_storage_mb_remaining,
        ),
        operator_storage_mb_low_alert: String(
          s.operator_storage_mb_low_alert ?? payload.operator_storage_mb_low_alert,
        ),
      })
      toast('Ehtiyat sayğacları yeniləndi')
      await loadInventory()
    } catch (e) {
      toast(e?.message || 'Xəta', 'error')
    } finally {
      setSavingStock(false)
    }
  }

  const op = inventory?.operator
  const usage = inventory?.usage
  const nearLimit = inventory?.instructors_near_limit || []
  const alerts = inventory?.alerts || []

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl">Platform ödənişləri</h1>
        <p className="text-gray-400 text-sm mt-1">
          Köçürmə hesabı, əlavə paketlər, manual təsdiqlər.{' '}
          <Link to="/admin/inventory" className="text-primary hover:underline font-medium">
            SMS & Ehtiyat →
          </Link>{' '}
          (ümumi və qalan balans)
        </p>
      </div>

      {alerts.length > 0 ? (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div
              key={`${a.kind}-${i}`}
              className={[
                'rounded-xl border px-4 py-3 text-sm',
                a.level === 'critical'
                  ? 'border-rose-500/40 bg-rose-500/15 text-rose-100'
                  : 'border-amber-500/40 bg-amber-500/15 text-amber-100',
              ].join(' ')}
            >
              {a.message}
            </div>
          ))}
        </div>
      ) : null}

      <Card className="p-5 space-y-5">
        <div>
          <h2 className="font-display font-bold text-sm">SMS və yaddaş ehtiyatı</h2>
          <p className="text-xs text-gray-500 mt-1">
            Provayderdən aldığınız SMS və hosting yaddaşını burada izləyin. Azaldıqda sifariş vermək üçün xəbərdarlıq
            həddi təyin edin.
          </p>
        </div>

        {inventoryLoading ? (
          <div className="text-sm text-gray-500">Ehtiyat yüklənir…</div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className={`rounded-xl border p-4 ${stockCardCls(op?.sms_low)}`}>
                <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">SMS ehtiyatı</div>
                <div className="font-display font-bold text-2xl text-white">
                  {(op?.operator_sms_stock_remaining ?? 0).toLocaleString('az-AZ')} ədəd
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Xəbərdarlıq həddi: ≤ {(op?.operator_sms_low_alert ?? 500).toLocaleString('az-AZ')} ədəd
                  {op?.sms_low ? ' · Sifariş lazımdır' : ''}
                </div>
              </div>
              <div className={`rounded-xl border p-4 ${stockCardCls(op?.storage_low)}`}>
                <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Yaddaş ehtiyatı</div>
                <div className="font-display font-bold text-2xl text-white">
                  {(op?.operator_storage_mb_remaining ?? 0).toLocaleString('az-AZ')} MB
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Xəbərdarlıq həddi: ≤ {(op?.operator_storage_mb_low_alert ?? 500).toLocaleString('az-AZ')} MB
                  {op?.storage_low ? ' · Artırma lazımdır' : ''}
                </div>
              </div>
            </div>

            {usage ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-sm">
                {[
                  ['Bu ay göndərilən SMS', usage.sms_sent_this_month],
                  ['Satılmış əlavə SMS (cəmi)', usage.extra_sms_sold_total],
                  ['Gözləyən SMS top-up', usage.pending_sms_topup],
                  ['Platform yaddaş istifadəsi', `${usage.storage_used_mb} MB`],
                  ['Satılmış əlavə yaddaş', `${usage.extra_storage_sold_mb} MB`],
                  ['Gözləyən yaddaş top-up', `${usage.pending_storage_topup_mb} MB`],
                ].map(([label, val]) => (
                  <div key={label} className="rounded-lg bg-[#13112e] border border-indigo-500/15 px-3 py-2">
                    <div className="text-[10px] text-gray-500 uppercase">{label}</div>
                    <div className="font-semibold text-white mt-0.5">
                      {typeof val === 'number' ? val.toLocaleString('az-AZ') : val}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-3 rounded-xl border border-indigo-500/15 p-3">
                <h3 className="text-xs font-semibold text-gray-300">SMS sayğacını yenilə</h3>
                <label className="block text-xs text-gray-400">
                  Qalan SMS (provayder balansı)
                  <input
                    type="number"
                    min={0}
                    className="mt-1 w-full bg-[#13112e] border border-indigo-500/20 rounded-lg px-3 py-2 text-white text-sm"
                    value={operatorDraft.operator_sms_stock_remaining}
                    onChange={(e) =>
                      setOperatorDraft((d) => ({ ...d, operator_sms_stock_remaining: e.target.value }))
                    }
                  />
                </label>
                <label className="block text-xs text-gray-400">
                  Aşağı ehtiyat xəbərdarlığı (ədəd)
                  <input
                    type="number"
                    min={0}
                    className="mt-1 w-full bg-[#13112e] border border-indigo-500/20 rounded-lg px-3 py-2 text-white text-sm"
                    value={operatorDraft.operator_sms_low_alert}
                    onChange={(e) => setOperatorDraft((d) => ({ ...d, operator_sms_low_alert: e.target.value }))}
                  />
                </label>
              </div>
              <div className="space-y-3 rounded-xl border border-indigo-500/15 p-3">
                <h3 className="text-xs font-semibold text-gray-300">Yaddaş sayğacını yenilə</h3>
                <label className="block text-xs text-gray-400">
                  Qalan yaddaş (MB)
                  <input
                    type="number"
                    min={0}
                    className="mt-1 w-full bg-[#13112e] border border-indigo-500/20 rounded-lg px-3 py-2 text-white text-sm"
                    value={operatorDraft.operator_storage_mb_remaining}
                    onChange={(e) =>
                      setOperatorDraft((d) => ({ ...d, operator_storage_mb_remaining: e.target.value }))
                    }
                  />
                </label>
                <label className="block text-xs text-gray-400">
                  Aşağı ehtiyat xəbərdarlığı (MB)
                  <input
                    type="number"
                    min={0}
                    className="mt-1 w-full bg-[#13112e] border border-indigo-500/20 rounded-lg px-3 py-2 text-white text-sm"
                    value={operatorDraft.operator_storage_mb_low_alert}
                    onChange={(e) =>
                      setOperatorDraft((d) => ({ ...d, operator_storage_mb_low_alert: e.target.value }))
                    }
                  />
                </label>
              </div>
            </div>

            <Button loading={savingStock} onClick={() => void saveOperatorStock()}>
              Ehtiyatı saxla
            </Button>

            {nearLimit.length > 0 ? (
              <div>
                <h3 className="text-xs font-semibold text-gray-300 mb-2">
                  Limitə yaxın müəllimlər (≥80%)
                </h3>
                <div className="overflow-x-auto rounded-xl border border-indigo-500/15">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-indigo-500/20 text-gray-500 uppercase">
                        {['Müəllim', 'Plan', 'SMS', 'Yaddaş'].map((h) => (
                          <th key={h} className="py-2 px-3 text-left font-semibold">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {nearLimit.map((row) => (
                        <tr key={row.id} className="border-b border-indigo-500/10">
                          <td className="py-2 px-3 text-white">{row.full_name || row.email}</td>
                          <td className="py-2 px-3 text-gray-400">{String(row.plan || '').toUpperCase()}</td>
                          <td className="py-2 px-3 text-gray-300">
                            {row.sms_cap != null
                              ? `${row.sms_used}/${row.sms_cap} (${row.sms_pct}%)`
                              : '—'}
                          </td>
                          <td className="py-2 px-3 text-gray-300">
                            {row.storage_cap_mb != null
                              ? `${row.storage_used_mb}/${row.storage_cap_mb} MB (${row.storage_pct}%)`
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </>
        )}
      </Card>

      <Card className="p-5 space-y-6">
        <div>
          <h2 className="font-display font-bold text-sm mb-3">Bank kartı nömrəsi (16 rəqəm)</h2>
          <input
            className="w-full max-w-md bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm font-mono tracking-wider"
            value={accountDraft}
            maxLength={BANK_CARD_DIGITS}
            inputMode="numeric"
            onChange={(e) => setAccountDraft(normalizeBankCardDigits(e.target.value))}
            placeholder="0000000000000000"
          />
          <p className="text-xs text-gray-500 mt-2">
            Müəllim köçürmə seçəndə bu kart nömrəsi göstərilir ({accountDraft.replace(/\D/g, '').length}/{BANK_CARD_DIGITS} rəqəm).
          </p>
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
                  disabled={smsPacksDraft.length <= 1}
                  onClick={() => removePackRow(idx)}
                >
                  Sil
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="font-display font-bold text-sm">Əlavə yaddaş paketləri</h2>
            <Button type="button" size="sm" variant="secondary" onClick={addStoragePackRow}>
              + Paket
            </Button>
          </div>
          <p className="text-xs text-gray-500 mb-3 leading-relaxed">
            Müəllim <strong className="text-gray-300">Tənzimləmələr → Əlavə yaddaş</strong> modalında bu paketlər görünür.
            GB daxil etdikdə MB avtomatik hesablanır (1 GB = 1024 MB). Dəyişikliklər «Tənzimləmələri saxla» ilə
            dərhal tətbiq olunur.
          </p>
          <div className="space-y-3">
            {storagePacksDraft.map((p, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 sm:grid-cols-[0.8fr_0.9fr_0.7fr_1.4fr_auto] gap-2 items-end rounded-xl border border-indigo-500/15 p-3"
              >
                <label className="block text-xs text-gray-400">
                  Həcm (GB)
                  <input
                    type="number"
                    min={0.1}
                    step={0.1}
                    className="mt-1 w-full bg-[#13112e] border border-indigo-500/20 rounded-lg px-3 py-2 text-white text-sm"
                    value={p.quantity_gb}
                    onChange={(e) => patchStoragePack(idx, 'quantity_gb', e.target.value)}
                  />
                  {p.quantity_mb ? (
                    <span className="text-[10px] text-gray-500 mt-0.5 block">= {p.quantity_mb} MB limitə əlavə</span>
                  ) : null}
                </label>
                <label className="block text-xs text-gray-400">
                  Qiymət (AZN)
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    className="mt-1 w-full bg-[#13112e] border border-indigo-500/20 rounded-lg px-3 py-2 text-white text-sm"
                    value={p.price_azn}
                    onChange={(e) => patchStoragePack(idx, 'price_azn', e.target.value)}
                  />
                </label>
                <label className="block text-xs text-gray-400">
                  Dövr
                  <select
                    className="mt-1 w-full bg-[#13112e] border border-indigo-500/20 rounded-lg px-3 py-2 text-white text-sm"
                    value={p.billing_period}
                    onChange={(e) => patchStoragePack(idx, 'billing_period', e.target.value)}
                  >
                    <option value="monthly">Aylıq</option>
                    <option value="yearly">İllik</option>
                  </select>
                </label>
                <label className="block text-xs text-gray-400">
                  Başlıq (UI)
                  <input
                    type="text"
                    className="mt-1 w-full bg-[#13112e] border border-indigo-500/20 rounded-lg px-3 py-2 text-white text-sm"
                    value={p.label}
                    placeholder="+1 GB Sənəd Yaddaşı"
                    onChange={(e) => patchStoragePack(idx, 'label', e.target.value)}
                  />
                </label>
                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  disabled={storagePacksDraft.length <= 1}
                  onClick={() => removeStoragePackRow(idx)}
                >
                  Sil
                </Button>
              </div>
            ))}
          </div>
        </div>

        <Button loading={savingSettings} onClick={() => void saveSettings()}>
          Tənzimləmələri saxla
        </Button>
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
                        : p.product_type === 'storage'
                          ? `+${p.storage_mb || 0} MB yaddaş`
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
                        {STATUS_LABEL[p.status] || billingPaymentStatusLabel(p.status)}
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
