import { useEffect, useState } from 'react'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'
import api from '../../lib/api'

export default function AdminSettings() {
  const [smsDefaults, setSmsDefaults] = useState({ default_sms_limit: 100, default_storage_mb: 1024, default_ram_mb: 512 })
  const [plans, setPlans] = useState([])
  const [plansBusy, setPlansBusy] = useState(false)
  const [plansErr, setPlansErr] = useState(null)
  const toast = useToast()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const d = await api.get('/admin/plans')
        if (!cancelled) setPlans(Array.isArray(d?.plans) ? d.plans : [])
      } catch (e) {
        if (!cancelled) setPlansErr(e?.message || 'Planlar yüklənmədi')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="p-4 sm:p-6 min-w-0 max-w-3xl mx-auto w-full">
      <h1 className="font-display font-bold text-xl sm:text-2xl mb-4 sm:mb-6 break-words">Tənzimləmələr</h1>

      <div className="w-full space-y-4 sm:space-y-6">
        <Card className="p-4 sm:p-6">
          <h2 className="font-display font-bold text-base mb-4">💳 Paketlər (Billing)</h2>
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
                    <div className="text-sm font-bold text-white">{p.slug.toUpperCase()}</div>
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
                    setPlans(Array.isArray(d?.plans) ? d.plans : plans)
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

        <Card className="p-4 sm:p-6">
          <h2 className="font-display font-bold text-base mb-4">📱 SMS Defolt Limitlər</h2>
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
