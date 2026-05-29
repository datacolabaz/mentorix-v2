import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'

function emptyStock() {
  return {
    operator_sms_stock_total: '',
    operator_sms_stock_remaining: '',
    operator_sms_low_alert: '500',
    operator_storage_mb_total: '',
    operator_storage_mb_remaining: '',
    operator_storage_mb_low_alert: '500',
  }
}

function stockCardCls(low, configured) {
  if (!configured) return 'border-amber-500/35 bg-amber-500/5'
  return low ? 'border-rose-500/40 bg-rose-500/10' : 'border-emerald-500/25 bg-emerald-500/5'
}

function StatBig({ label, value, sub }) {
  return (
    <div className="rounded-2xl border border-indigo-500/20 bg-[#13112e] p-5">
      <div className="text-[11px] uppercase tracking-wider text-gray-500">{label}</div>
      <div className="font-display font-bold text-3xl text-white mt-2">{value}</div>
      {sub ? <div className="text-xs text-gray-500 mt-2">{sub}</div> : null}
    </div>
  )
}

export default function AdminInventory() {
  const toast = useToast()
  const [inventory, setInventory] = useState(null)
  const [draft, setDraft] = useState(emptyStock())
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [invRes, settingsRes] = await Promise.all([
        api.get('/admin/billing/inventory'),
        api.get('/admin/billing/settings'),
      ])
      const inv = invRes.inventory || null
      setInventory(inv)
      const s = settingsRes.settings || settingsRes
      setDraft({
        operator_sms_stock_total: String(s.operator_sms_stock_total ?? ''),
        operator_sms_stock_remaining: String(s.operator_sms_stock_remaining ?? ''),
        operator_sms_low_alert: String(s.operator_sms_low_alert ?? '500'),
        operator_storage_mb_total: String(s.operator_storage_mb_total ?? ''),
        operator_storage_mb_remaining: String(s.operator_storage_mb_remaining ?? ''),
        operator_storage_mb_low_alert: String(s.operator_storage_mb_low_alert ?? '500'),
      })
    } catch (e) {
      setLoadError(e?.message || 'Yüklənmədi')
      setInventory(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function save() {
    setSaving(true)
    try {
      const payload = {
        operator_sms_stock_total: Math.max(0, Math.round(Number(draft.operator_sms_stock_total) || 0)),
        operator_sms_stock_remaining: Math.max(0, Math.round(Number(draft.operator_sms_stock_remaining) || 0)),
        operator_sms_low_alert: Math.max(0, Math.round(Number(draft.operator_sms_low_alert) || 0)),
        operator_storage_mb_total: Math.max(0, Math.round(Number(draft.operator_storage_mb_total) || 0)),
        operator_storage_mb_remaining: Math.max(0, Math.round(Number(draft.operator_storage_mb_remaining) || 0)),
        operator_storage_mb_low_alert: Math.max(0, Math.round(Number(draft.operator_storage_mb_low_alert) || 0)),
      }
      await api.put('/admin/billing/settings', payload)
      toast('Ehtiyat saxlanıldı')
      await load()
    } catch (e) {
      toast(e?.message || 'Xəta', 'error')
    } finally {
      setSaving(false)
    }
  }

  const op = inventory?.operator
  const usage = inventory?.usage
  const alerts = inventory?.alerts || []
  const configured = op?.inventory_configured

  const smsTotal = op?.operator_sms_stock_total ?? 0
  const smsRem = op?.operator_sms_stock_remaining ?? 0
  const stTotal = op?.operator_storage_mb_total ?? 0
  const stRem = op?.operator_storage_mb_remaining ?? 0

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="font-display font-bold text-2xl">SMS və yaddaş ehtiyatı</h1>
        <p className="text-gray-400 text-sm mt-1">
          Provayderdən aldığınız ümumi və qalan SMS / yaddaş — azaldıqda sifariş üçün xəbərdarlıq
        </p>
      </div>

      {loadError ? (
        <Card className="p-4 border-rose-500/30 bg-rose-500/10 text-rose-100 text-sm">
          <p className="font-semibold">Məlumat yüklənmədi</p>
          <p className="mt-1 text-rose-200/90">{loadError}</p>
          <p className="mt-2 text-xs text-rose-200/70">
            Backend yenilənməyibsə bu səhifə işləməyə bilər. Deploy-dan sonra yenidən yoxlayın.
          </p>
          <Button className="mt-3" size="sm" variant="secondary" onClick={() => void load()}>
            Yenidən cəhd et
          </Button>
        </Card>
      ) : null}

      {alerts.length > 0 && !loadError ? (
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

      {loading ? (
        <div className="text-gray-500 text-sm">Yüklənir…</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className={`rounded-2xl border p-5 ${stockCardCls(op?.sms_low, configured)}`}>
              <div className="text-xs text-gray-400 uppercase mb-3">SMS (provayder)</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] text-gray-500 uppercase">Ümumi alınıb</div>
                  <div className="font-display font-bold text-2xl text-white mt-1">
                    {configured ? smsTotal.toLocaleString('az-AZ') : '—'} <span className="text-sm font-normal text-gray-500">ədəd</span>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500 uppercase">Qalan ehtiyat</div>
                  <div className="font-display font-bold text-2xl text-white mt-1">
                    {configured ? smsRem.toLocaleString('az-AZ') : '—'} <span className="text-sm font-normal text-gray-500">ədəd</span>
                  </div>
                </div>
              </div>
              {configured && smsTotal > 0 ? (
                <div className="mt-3 h-1.5 rounded-full bg-black/30 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500/80 rounded-full"
                    style={{ width: `${Math.min(100, Math.round((smsRem / smsTotal) * 100))}%` }}
                  />
                </div>
              ) : null}
            </div>

            <div className={`rounded-2xl border p-5 ${stockCardCls(op?.storage_low, configured)}`}>
              <div className="text-xs text-gray-400 uppercase mb-3">Yaddaş (hosting)</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] text-gray-500 uppercase">Ümumi alınıb</div>
                  <div className="font-display font-bold text-2xl text-white mt-1">
                    {configured ? stTotal.toLocaleString('az-AZ') : '—'} <span className="text-sm font-normal text-gray-500">MB</span>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500 uppercase">Qalan ehtiyat</div>
                  <div className="font-display font-bold text-2xl text-white mt-1">
                    {configured ? stRem.toLocaleString('az-AZ') : '—'} <span className="text-sm font-normal text-gray-500">MB</span>
                  </div>
                </div>
              </div>
              {configured && stTotal > 0 ? (
                <div className="mt-3 h-1.5 rounded-full bg-black/30 overflow-hidden">
                  <div
                    className="h-full bg-blue-500/80 rounded-full"
                    style={{ width: `${Math.min(100, Math.round((stRem / stTotal) * 100))}%` }}
                  />
                </div>
              ) : null}
            </div>
          </div>

          {usage ? (
            <div>
              <h2 className="font-display font-bold text-sm mb-3 text-gray-300">Platformda (müəllimlər)</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <StatBig
                  label="Müəllimlərə verilmiş SMS limiti (cəmi)"
                  value={(usage.sms_allocated_to_instructors ?? 0).toLocaleString('az-AZ')}
                  sub={`Bu ay göndərilən: ${(usage.sms_sent_this_month ?? 0).toLocaleString('az-AZ')}`}
                />
                <StatBig
                  label="Müəllimlərə verilmiş yaddaş (cəmi)"
                  value={`${(usage.storage_allocated_mb ?? 0).toLocaleString('az-AZ')} MB`}
                  sub={`İstifadə olunur: ${(usage.storage_used_mb ?? 0).toLocaleString('az-AZ')} MB`}
                />
                <StatBig
                  label="Satılmış əlavə paketlər"
                  value={`+${(usage.extra_sms_sold_total ?? 0).toLocaleString('az-AZ')} SMS`}
                  sub={`+${(usage.extra_storage_sold_mb ?? 0).toLocaleString('az-AZ')} MB yaddaş`}
                />
              </div>
            </div>
          ) : null}

          <Card className="p-5 space-y-4">
            <h2 className="font-display font-bold text-sm">Ehtiyatı qeyd et / yenilə</h2>
            <p className="text-xs text-gray-500">
              SMS provayder panelindən və hostingdən gördüyünüz rəqəmləri yazın. Hər sifarişdən sonra «Qalan»ı
              yeniləyin.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-3 rounded-xl border border-indigo-500/15 p-3">
                <h3 className="text-xs font-semibold text-gray-300">SMS</h3>
                {[
                  ['Ümumi alınmış SMS', 'operator_sms_stock_total'],
                  ['Qalan SMS (provayder)', 'operator_sms_stock_remaining'],
                  ['Aşağı xəbərdarlıq (ədəd)', 'operator_sms_low_alert'],
                ].map(([label, key]) => (
                  <label key={key} className="block text-xs text-gray-400">
                    {label}
                    <input
                      type="number"
                      min={0}
                      className="mt-1 w-full bg-[#13112e] border border-indigo-500/20 rounded-lg px-3 py-2 text-white text-sm"
                      value={draft[key]}
                      onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                    />
                  </label>
                ))}
              </div>
              <div className="space-y-3 rounded-xl border border-indigo-500/15 p-3">
                <h3 className="text-xs font-semibold text-gray-300">Yaddaş (MB)</h3>
                {[
                  ['Ümumi alınmış yaddaş (MB)', 'operator_storage_mb_total'],
                  ['Qalan yaddaş (MB)', 'operator_storage_mb_remaining'],
                  ['Aşağı xəbərdarlıq (MB)', 'operator_storage_mb_low_alert'],
                ].map(([label, key]) => (
                  <label key={key} className="block text-xs text-gray-400">
                    {label}
                    <input
                      type="number"
                      min={0}
                      className="mt-1 w-full bg-[#13112e] border border-indigo-500/20 rounded-lg px-3 py-2 text-white text-sm"
                      value={draft[key]}
                      onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                    />
                  </label>
                ))}
              </div>
            </div>
            <Button loading={saving} onClick={() => void save()}>
              Saxla
            </Button>
          </Card>

          {(inventory?.instructors_near_limit || []).length > 0 ? (
            <Card className="p-5 overflow-x-auto">
              <h2 className="font-display font-bold text-sm mb-3">Limitə yaxın müəllimlər</h2>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 uppercase border-b border-indigo-500/20">
                    {['Müəllim', 'Plan', 'SMS', 'Yaddaş'].map((h) => (
                      <th key={h} className="py-2 px-2 text-left font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {inventory.instructors_near_limit.map((row) => (
                    <tr key={row.id} className="border-b border-indigo-500/10">
                      <td className="py-2 px-2 text-white">{row.full_name}</td>
                      <td className="py-2 px-2 text-gray-400">{String(row.plan || '').toUpperCase()}</td>
                      <td className="py-2 px-2 text-gray-300">
                        {row.sms_cap != null ? `${row.sms_used}/${row.sms_cap} (${row.sms_pct}%)` : '—'}
                      </td>
                      <td className="py-2 px-2 text-gray-300">
                        {row.storage_cap_mb != null
                          ? `${row.storage_used_mb}/${row.storage_cap_mb} MB`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ) : null}
        </>
      )}

      <p className="text-xs text-gray-600">
        <Link to="/admin/billing" className="text-primary hover:underline">
          Platform ödənişləri →
        </Link>{' '}
        (paket qiymətləri və köçürmələr)
      </p>
    </div>
  )
}
