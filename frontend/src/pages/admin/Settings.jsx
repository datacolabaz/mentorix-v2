import { useCallback, useEffect, useState } from 'react'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'
import api from '../../lib/api'

function formatBytesAz(n) {
  const b = Number(n)
  if (!Number.isFinite(b) || b < 0) return null
  if (b < 1024) return `${Math.round(b)} bayt`
  if (b < 1024 * 1024) return `${Math.round((b / 1024) * 10) / 10} KB`
  const mb = b / (1024 * 1024)
  return mb >= 10 ? `${Math.round(mb)} MB` : `${Math.round(mb * 10) / 10} MB`
}

/** DB-dən gələn features bəzən jsonb obyekt/string ola bilər — textarea üçün sətir siyahısına çevir */
function normalizePlanFeatures(raw) {
  if (Array.isArray(raw)) return raw.map((x) => String(x ?? '').trim()).filter(Boolean)
  if (raw == null) return []
  if (typeof raw === 'string') {
    const s = raw.trim()
    if (!s) return []
    try {
      const p = JSON.parse(s)
      return Array.isArray(p) ? p.map((x) => String(x ?? '').trim()).filter(Boolean) : []
    } catch {
      return s.split('\n').map((x) => x.trim()).filter(Boolean)
    }
  }
  if (typeof raw === 'object') return []
  return []
}

export default function AdminSettings() {
  const [smsDefaults, setSmsDefaults] = useState({ default_sms_limit: 100, default_storage_mb: 1024, default_ram_mb: 512 })
  const [plans, setPlans] = useState([])
  const [plansBusy, setPlansBusy] = useState(false)
  const [plansReloadBusy, setPlansReloadBusy] = useState(false)
  const [plansErr, setPlansErr] = useState(null)
  const [plansLoadedAt, setPlansLoadedAt] = useState(null)
  const toast = useToast()

  const fetchPlans = useCallback(async () => {
    setPlansErr(null)
    const d = await api.get(`/admin/plans?t=${Date.now()}`)
    const list = Array.isArray(d?.plans) ? d.plans : []
    setPlans(
      list.map((p) => ({
        ...p,
        features: normalizePlanFeatures(p.features),
      })),
    )
    setPlansLoadedAt(new Date().toISOString())
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await fetchPlans()
      } catch (e) {
        if (!cancelled) setPlansErr(e?.message || 'Planlar yüklənmədi')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [fetchPlans])

  return (
    <div className="p-4 sm:p-6 min-w-0 max-w-3xl mx-auto w-full">
      <h1 className="font-display font-bold text-xl sm:text-2xl mb-4 sm:mb-6 break-words">Tənzimləmələr</h1>

      <div className="w-full space-y-4 sm:space-y-6">
        <Card className="p-4 sm:p-6">
          <h2 className="font-display font-bold text-base mb-4">💳 Paketlər (Billing)</h2>
          <p className="text-xs text-gray-500 mb-3 leading-relaxed">
            <strong className="text-gray-300">Storage (GB)</strong> — böyük limitlər üçün.{' '}
            <strong className="text-gray-300">Yaddaş (bayt)</strong> — dəqiq kiçik limit (məs. pulsuz sıra: 512 KB ={' '}
            <code className="text-indigo-300">524288</code>). Bayt doldurulubsa, GB ilə yuvarlama tətbiq olunmur.
          </p>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            {plansLoadedAt ? (
              <p className="text-[11px] text-gray-500">
                Son yükləmə:{' '}
                <span className="text-gray-300 tabular-nums">{new Date(plansLoadedAt).toLocaleString('az-AZ')}</span>
              </p>
            ) : (
              <span />
            )}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={plansReloadBusy}
              className="shrink-0"
              onClick={async () => {
                setPlansReloadBusy(true)
                try {
                  await fetchPlans()
                  toast('Paketlər yeniləndi')
                } catch (e) {
                  setPlansErr(e?.message || 'Yenilənmədi')
                } finally {
                  setPlansReloadBusy(false)
                }
              }}
            >
              Serverdən yenilə
            </Button>
          </div>
          {plansErr ? (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-100 px-4 py-3 text-sm mb-4">
              {plansErr}
            </div>
          ) : null}
          {!plans.length ? (
            <div className="text-sm text-gray-400">Plan yoxdur (migration işləməyibsə, backend restart/deploy edin).</div>
          ) : (
            <div className="space-y-4">
              {plans.map((p, idx) => (
                <div key={p.slug} className="rounded-2xl border border-indigo-500/15 bg-[#0f0c29]/60 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold text-white">{p.slug.toUpperCase()}</div>
                      {p.updated_at ? (
                        <div className="text-[10px] text-gray-500 mt-0.5 tabular-nums">
                          DB: {new Date(p.updated_at).toLocaleString('az-AZ')}
                        </div>
                      ) : null}
                    </div>
                    <label className="text-xs text-gray-300 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={Boolean(p.is_active)}
                        onChange={(e) =>
                          setPlans((arr) => arr.map((x, i) => (i === idx ? { ...x, is_active: e.target.checked } : x)))
                        }
                      />
                      Aktiv
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Başlıq</label>
                      <input
                        className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500"
                        value={p.title ?? ''}
                        onChange={(e) =>
                          setPlans((arr) => arr.map((x, i) => (i === idx ? { ...x, title: e.target.value } : x)))
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Qiymət (AZN)</label>
                      <input
                        type="number"
                        className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500"
                        value={p.price_azn ?? 0}
                        onChange={(e) =>
                          setPlans((arr) =>
                            arr.map((x, i) => (i === idx ? { ...x, price_azn: Number(e.target.value || 0) } : x))
                          )
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Student limit</label>
                      <input
                        type="number"
                        className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500"
                        value={p.student_limit ?? ''}
                        placeholder="boş = limitsiz"
                        onChange={(e) =>
                          setPlans((arr) =>
                            arr.map((x, i) => (i === idx ? { ...x, student_limit: e.target.value === '' ? null : Number(e.target.value) } : x))
                          )
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Storage (GB)</label>
                      <input
                        type="number"
                        className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500"
                        value={p.storage_gb ?? ''}
                        placeholder="boş = limitsiz"
                        onChange={(e) =>
                          setPlans((arr) =>
                            arr.map((x, i) => (i === idx ? { ...x, storage_gb: e.target.value === '' ? null : Number(e.target.value) } : x))
                          )
                        }
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        Yaddaş limiti (bayt)
                      </label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        <button
                          type="button"
                          className="text-xs px-3 py-1.5 rounded-lg border border-indigo-500/30 text-gray-200 hover:bg-indigo-500/10"
                          onClick={() =>
                            setPlans((arr) =>
                              arr.map((x, i) => (i === idx ? { ...x, storage_limit_bytes: 512 * 1024 } : x)),
                            )
                          }
                        >
                          512 KB (524288)
                        </button>
                        <button
                          type="button"
                          className="text-xs px-3 py-1.5 rounded-lg border border-indigo-500/30 text-gray-200 hover:bg-indigo-500/10"
                          onClick={() =>
                            setPlans((arr) => arr.map((x, i) => (i === idx ? { ...x, storage_limit_bytes: null } : x)))
                          }
                        >
                          Bayt limitini sil
                        </button>
                      </div>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500"
                        value={p.storage_limit_bytes ?? ''}
                        placeholder="boş — əvvəlki dəyər saxlanılır (yalnız «Bayt limitini sil» ilə sıfırla)"
                        onChange={(e) => {
                          const v = e.target.value
                          setPlans((arr) =>
                            arr.map((x, i) => {
                              if (i !== idx) return x
                              if (v === '') return { ...x, storage_limit_bytes: undefined }
                              const n = Number(v)
                              return { ...x, storage_limit_bytes: Number.isFinite(n) ? n : x.storage_limit_bytes }
                            }),
                          )
                        }}
                      />
                      {p.storage_limit_bytes != null && Number.isFinite(Number(p.storage_limit_bytes)) ? (
                        <p className="text-[11px] text-indigo-200/90 mt-1">
                          Aktiv limit:{' '}
                          <span className="font-semibold tabular-nums">{formatBytesAz(p.storage_limit_bytes)}</span>
                        </p>
                      ) : null}
                      <p className="text-[11px] text-gray-500 mt-1.5">
                        Saxlayarkən: boş sahə serverdə mövcud bayt limitini dəyişmir. Aydın sıfırlama üçün «Bayt limitini sil».
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">SMS limit</label>
                      <input
                        type="number"
                        className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500"
                        value={p.sms_limit ?? ''}
                        placeholder="boş = limitsiz"
                        onChange={(e) =>
                          setPlans((arr) =>
                            arr.map((x, i) => (i === idx ? { ...x, sms_limit: e.target.value === '' ? null : Number(e.target.value) } : x))
                          )
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">RAM limit (MB)</label>
                      <input
                        type="number"
                        className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500"
                        value={p.ram_limit_mb ?? ''}
                        placeholder="boş = limitsiz"
                        onChange={(e) =>
                          setPlans((arr) =>
                            arr.map((x, i) => (i === idx ? { ...x, ram_limit_mb: e.target.value === '' ? null : Number(e.target.value) } : x))
                          )
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Xidmətlər (hər sətir 1 maddə)</label>
                    <textarea
                      rows={4}
                      className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500"
                      value={Array.isArray(p.features) ? p.features.join('\n') : ''}
                      onChange={(e) =>
                        setPlans((arr) =>
                          arr.map((x, i) =>
                            i === idx ? { ...x, features: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) } : x
                          )
                        )
                      }
                    />
                  </div>

                  <label className="text-xs text-gray-300 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(p.highlight)}
                      onChange={(e) =>
                        setPlans((arr) => arr.map((x, i) => (i === idx ? { ...x, highlight: e.target.checked } : x)))
                      }
                    />
                    Highlight (PRO)
                  </label>
                </div>
              ))}

              <Button
                loading={plansBusy}
                className="w-full justify-center"
                onClick={async () => {
                  setPlansErr(null)
                  setPlansBusy(true)
                  try {
                    const d = await api.put('/admin/plans', { plans })
                    const saved = Array.isArray(d?.plans) ? d.plans : []
                    setPlans(
                      saved.map((row) => ({
                        ...row,
                        features: normalizePlanFeatures(row.features),
                      })),
                    )
                    setPlansLoadedAt(new Date().toISOString())
                    toast('Planlar saxlanıldı')
                  } catch (e) {
                    setPlansErr(e?.message || 'Saxlanmadı')
                  } finally {
                    setPlansBusy(false)
                  }
                }}
              >
                Planları yadda saxla
              </Button>
            </div>
          )}
        </Card>

        <Card className="p-4 sm:p-6 border border-amber-500/20">
          <h2 className="font-display font-bold text-base mb-2">📱 SMS defolt (köhnə UI)</h2>
          <p className="text-xs text-amber-200/90 mb-4 leading-relaxed">
            Bu blok <strong className="text-white">bazaya yazılmır</strong> — dəyərlər brauzerdə saxlanır, səhifəni bağlayanda itir.
            Müəllim limitləri yalnız yuxarıdakı <strong className="text-white">Paketlər (Billing)</strong> cədvəlindən gəlir (
            <code className="text-indigo-300">subscription_plans</code>). Əgər köhnə rəqamlar görürsünüzsə, əvvəlcə «Serverdən yenilə» və ya migrasiya/deploy yoxlayın.
          </p>
          <div className="space-y-4">
            {[
              { key: 'default_sms_limit', label: 'SMS Limiti', unit: 'SMS' },
              { key: 'default_storage_mb', label: 'Storage Limiti', unit: 'MB' },
              { key: 'default_ram_mb', label: 'RAM Limiti', unit: 'MB' },
            ].map(({ key, label, unit }) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{label} ({unit})</label>
                <input type="number" className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500"
                  value={smsDefaults[key]} onChange={e => setSmsDefaults(p => ({ ...p, [key]: e.target.value }))} />
              </div>
            ))}
            <Button onClick={() => toast('Yadda saxlandı!')} className="w-full justify-center">Yadda Saxla</Button>
          </div>
        </Card>

        <Card className="p-4 sm:p-6">
          <h2 className="font-display font-bold text-base mb-4">🔐 Sistem Məlumatları</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-indigo-500/10">
              <span className="text-gray-400">Versiya</span>
              <span className="text-white font-semibold">v2.0.0</span>
            </div>
            <div className="flex justify-between py-2 border-b border-indigo-500/10">
              <span className="text-gray-400">Database</span>
              <span className="text-emerald-400 font-semibold">✓ Qoşulub</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-400">SMS Servisi</span>
              <span className="text-emerald-400 font-semibold">✓ Aktiv</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
