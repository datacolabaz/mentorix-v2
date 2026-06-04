import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { az } from 'date-fns/locale'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import api from '../../lib/api'
import Card from '../../components/common/Card'

const PERIODS = [
  { id: '7d', label: '7 gün' },
  { id: '30d', label: '30 gün' },
  { id: 'all', label: 'Hamısı' },
]

const DEVICE_COLORS = {
  desktop: '#6366f1',
  mobile: '#22e0b8',
  tablet: '#f59e0b',
  unknown: '#64748b',
}

const SOURCE_COLORS = ['#22e0b8', '#6366f1', '#e1306c', '#1877f2', '#94a3b8', '#f59e0b']

function fmt(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  return new Intl.NumberFormat('az-Latn-AZ').format(Number(n))
}

function fmtPct(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  return `${Number(n).toLocaleString('az-Latn-AZ', { maximumFractionDigits: 1 })}%`
}

function OverviewCard({ label, value, sub }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#141820] to-[#0d1016] p-5">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{label}</div>
      <div className="mt-2 font-display text-3xl font-bold text-white tabular-nums">{value}</div>
      {sub ? <div className="mt-1 text-xs text-gray-500">{sub}</div> : null}
    </div>
  )
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-white/15 bg-[#0f1218] px-3 py-2 text-xs shadow-xl">
      <div className="text-gray-400 mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="text-white font-medium">
          {p.name}: {fmt(p.value)}
        </div>
      ))}
    </div>
  )
}

export default function AdminAnalytics() {
  const [period, setPeriod] = useState('30d')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    setErr(null)
    api
      .get('/admin/analytics/dashboard', { params: { period } })
      .then((r) => {
        if (r?.needs_migration) {
          setData(null)
          setErr('Migrasiya 118 və 119 işlədilməyib (access_events).')
          return
        }
        setData(r.analytics || null)
      })
      .catch((e) => setErr(e?.message || 'Yüklənmədi'))
      .finally(() => setLoading(false))
  }, [period])

  useEffect(() => {
    load()
  }, [load])

  const devicePie = useMemo(() => {
    const rows = data?.devices || []
    return rows.map((d) => ({
      name: d.device_type === 'desktop' ? 'Desktop' : d.device_type === 'mobile' ? 'Mobile' : d.device_type === 'tablet' ? 'Tablet' : 'Digər',
      value: d.count,
      key: d.device_type,
      pct: d.pct,
    }))
  }, [data])

  const sourcesBar = useMemo(
    () =>
      (data?.traffic_sources || []).map((s) => ({
        name: s.label,
        count: s.count,
        pct: s.pct,
      })),
    [data],
  )

  const trend = useMemo(() => {
    return (data?.trend_daily || []).map((r) => ({
      day: r.day ? new Date(r.day).toLocaleDateString('az-AZ', { day: 'numeric', month: 'short' }) : '',
      Ziyarətçi: r.visitors,
      Qeydiyyat: r.registrations,
    }))
  }, [data])

  const ov = data?.overview || {}
  const monthly = data?.monthly || {}

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">Analitika</h1>
          <p className="text-sm text-gray-500 mt-1">
            Ziyarətçilər, konversiya, trafik mənbələri və funnel — Mentorix.io
          </p>
        </div>
        <div className="flex rounded-xl border border-white/10 bg-[#0f1218] p-1">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className={[
                'px-4 py-2 rounded-lg text-xs font-semibold transition-colors',
                period === p.id ? 'bg-primary text-[#041018]' : 'text-gray-400 hover:text-white',
              ].join(' ')}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {err ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {err}
        </div>
      ) : null}

      {loading ? (
        <div className="text-sm text-gray-500 py-12 text-center">Analitika yüklənir…</div>
      ) : null}

      {!loading && data ? (
        <>
          <section>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
              Ümumi vəziyyət · {period === '7d' ? 'son 7 gün' : period === '30d' ? 'son 30 gün' : 'bütün dövr'}
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <OverviewCard label="Toplam ziyarət" value={fmt(ov.total_visitors)} sub="Səhifə baxışları" />
              <OverviewCard label="Unikal ziyarətçi" value={fmt(ov.unique_visitors)} sub="Sessiya üzrə" />
              <OverviewCard label="Qeydiyyatlar" value={fmt(ov.registrations)} />
              <OverviewCard label="Konversiya" value={fmtPct(ov.conversion_pct)} sub="Qeydiyyat / unikal" />
            </div>
          </section>

          <section>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Bu ay (platforma)</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {[
                ['Qeydiyyatlar', monthly.registrations],
                ['Müəllimlər', monthly.instructors],
                ['Tələbələr', monthly.students],
                ['İmtahanlar', monthly.exams],
                ['Tapşırıqlar', monthly.assignments],
                ['SMS', monthly.sms_sent],
                ['Gəlir', monthly.revenue_azn != null ? `₼${fmt(monthly.revenue_azn)}` : '—'],
              ].map(([label, val]) => (
                <div
                  key={label}
                  className="rounded-xl border border-white/8 bg-[#12151c] px-3 py-3 text-center"
                >
                  <div className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</div>
                  <div className="text-lg font-bold text-white tabular-nums mt-1">{typeof val === 'string' ? val : fmt(val)}</div>
                </div>
              ))}
            </div>
          </section>

          {trend.length > 1 ? (
            <Card className="p-5 !bg-[#0f1218] border-white/10">
              <h2 className="text-sm font-semibold text-white mb-4">Trend</h2>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend}>
                    <defs>
                      <linearGradient id="visGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22e0b8" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#22e0b8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} width={36} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="Ziyarətçi" stroke="#22e0b8" fill="url(#visGrad)" strokeWidth={2} />
                    <Area type="monotone" dataKey="Qeydiyyat" stroke="#6366f1" fill="none" strokeWidth={2} strokeDasharray="4 4" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          ) : null}

          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="p-5 !bg-[#0f1218] border-white/10">
              <h2 className="text-sm font-semibold text-white mb-1">Trafik mənbələri</h2>
              <p className="text-xs text-gray-500 mb-4">Reklam və axtarış kanalları</p>
              {sourcesBar.length ? (
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sourcesBar} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid stroke="rgba(255,255,255,0.06)" horizontal={false} />
                      <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" width={72} tick={{ fill: '#e2e8f0', fontSize: 11 }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="count" fill="#22e0b8" radius={[0, 6, 6, 0]} barSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-xs text-gray-500 py-8 text-center">Hələ məlumat yoxdur</p>
              )}
              <ul className="mt-3 space-y-1.5">
                {sourcesBar.map((s, i) => (
                  <li key={s.name} className="flex justify-between text-xs">
                    <span className="text-gray-300">{s.name}</span>
                    <span className="text-gray-500 tabular-nums">
                      {fmtPct(s.pct)} · {fmt(s.count)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="p-5 !bg-[#0f1218] border-white/10">
              <h2 className="text-sm font-semibold text-white mb-1">Cihazlar</h2>
              <p className="text-xs text-gray-500 mb-2">Ziyarət və girişlər üzrə</p>
              {devicePie.length ? (
                <div className="h-52 flex items-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={devicePie}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={78}
                        paddingAngle={2}
                      >
                        {devicePie.map((entry) => (
                          <Cell key={entry.key} fill={DEVICE_COLORS[entry.key] || '#64748b'} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-xs text-gray-500 py-8 text-center">Hələ məlumat yoxdur</p>
              )}
              <div className="flex flex-wrap gap-3 justify-center mt-2">
                {devicePie.map((d) => (
                  <span key={d.key} className="text-xs text-gray-400 flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: DEVICE_COLORS[d.key] || '#64748b' }}
                    />
                    {d.name} {fmtPct(d.pct)}
                  </span>
                ))}
              </div>
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="p-5 !bg-[#0f1218] border-white/10">
              <h2 className="text-sm font-semibold text-white mb-4">Ən çox baxılan səhifələr</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-white/10 text-xs">
                      <th className="pb-2 font-semibold">Səhifə</th>
                      <th className="pb-2 font-semibold text-right">Baxış</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.top_pages || []).map((row) => (
                      <tr key={row.path} className="border-b border-white/5">
                        <td className="py-2.5 font-mono text-xs text-primary/90">{row.path}</td>
                        <td className="py-2.5 text-right tabular-nums text-gray-200">{fmt(row.views)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!data.top_pages?.length ? (
                  <p className="text-xs text-gray-500 py-6 text-center">Hələ səhifə baxışı yoxdur</p>
                ) : null}
              </div>
            </Card>

            <Card className="p-5 !bg-[#0f1218] border-white/10">
              <h2 className="text-sm font-semibold text-white mb-4">Konversiya funnel</h2>
              <div className="space-y-3">
                {(data.funnel || []).map((step, i) => {
                  const widthPct = Math.max(8, step.pct_of_top || 0)
                  return (
                    <div key={step.step}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-300">
                          {i > 0 ? '↓ ' : ''}
                          {step.label}
                        </span>
                        <span className="text-gray-500 tabular-nums">
                          {fmt(step.count)}
                          {step.pct_of_top != null ? ` · ${fmtPct(step.pct_of_top)}` : ''}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary/80 to-indigo-500/80 transition-all"
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          </div>

          <Card className="p-5 !bg-[#0f1218] border-white/10">
            <h2 className="text-sm font-semibold text-white mb-4">Son qeydiyyatlar</h2>
            <div className="space-y-3">
              {(data.recent_registrations || []).map((u) => (
                <div
                  key={u.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 border-b border-white/5 last:border-0"
                >
                  <div>
                    <div className="text-sm font-semibold text-white">{u.full_name}</div>
                    <div className="text-xs text-gray-500 capitalize">{u.role || '—'}</div>
                  </div>
                  <div className="text-right text-xs">
                    <div className="text-gray-400">
                      {u.created_at
                        ? formatDistanceToNow(new Date(u.created_at), { addSuffix: true, locale: az })
                        : '—'}
                    </div>
                    <div className="text-primary font-medium mt-0.5">Mənbə: {u.source_label}</div>
                  </div>
                </div>
              ))}
              {!data.recent_registrations?.length ? (
                <p className="text-xs text-gray-500 text-center py-6">Bu dövrdə qeydiyyat yoxdur</p>
              ) : null}
            </div>
          </Card>
        </>
      ) : null}

      {!loading && !data && !err ? (
        <p className="text-sm text-gray-500 text-center py-12">
          Analitika boşdur. İstifadəçilər səhifəyə daxil olandan sonra məlumat toplanacaq.
        </p>
      ) : null}

      <p className="text-xs text-gray-600 text-center">
        <Link to="/admin" className="text-primary hover:underline">
          ← Dashboard
        </Link>
      </p>
    </div>
  )
}
