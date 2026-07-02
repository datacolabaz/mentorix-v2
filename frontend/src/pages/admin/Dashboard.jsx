import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { az } from 'date-fns/locale'
import api from '../../lib/api'
import Card from '../../components/common/Card'

const ROLE_LABELS = {
  instructor: 'müəllim',
  student: 'tələbə',
  admin: 'admin',
  parent: 'valideyn',
}

function fmt(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  return new Intl.NumberFormat('az-Latn-AZ').format(Number(n))
}

function fmtMoney(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  return `₼${fmt(n)}`
}

function fmtPct(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  return `${Number(n).toLocaleString('az-Latn-AZ', { maximumFractionDigits: 1 })}%`
}

function PulseCard({ label, value, sub, accent = 'primary' }) {
  const accentClass =
    accent === 'emerald'
      ? 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/25'
      : accent === 'violet'
        ? 'from-violet-500/20 to-violet-500/5 border-violet-500/25'
        : accent === 'amber'
          ? 'from-amber-500/20 to-amber-500/5 border-amber-500/25'
          : 'from-primary/20 to-primary/5 border-primary/25'
  return (
    <div
      className={`rounded-2xl border bg-gradient-to-br p-5 ${accentClass}`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{label}</div>
      <div className="mt-2 font-display font-bold text-3xl text-white tabular-nums">{value}</div>
      {sub ? <div className="mt-1 text-xs text-gray-500">{sub}</div> : null}
    </div>
  )
}

function severityStyles(severity) {
  if (severity === 'critical') return 'border-rose-500/35 bg-rose-500/10 hover:bg-rose-500/15'
  if (severity === 'warning') return 'border-amber-500/35 bg-amber-500/10 hover:bg-amber-500/15'
  return 'border-white/10 bg-white/[0.03] hover:bg-white/[0.05]'
}

function severityBadge(severity, count) {
  if (count <= 0) return 'bg-white/10 text-gray-500'
  if (severity === 'critical') return 'bg-rose-500/25 text-rose-200'
  if (severity === 'warning') return 'bg-amber-500/25 text-amber-200'
  return 'bg-primary/20 text-primary'
}

export default function AdminDashboard() {
  const [dashboard, setDashboard] = useState(null)
  const [inventoryAlerts, setInventoryAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const [ceoRes, inventoryRes] = await Promise.all([
          api.get('/admin/ceo-dashboard'),
          api.get('/admin/billing/inventory').catch(() => ({ inventory: null })),
        ])
        if (cancelled) return
        setDashboard(ceoRes.dashboard || null)
        setInventoryAlerts(inventoryRes.inventory?.alerts || [])
        setErr(null)
      } catch (e) {
        if (!cancelled) {
          setErr(e?.message || 'Yüklənmədi')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    const refreshMs = (dashboard?.refresh_seconds || 30) * 1000
    const timer = window.setInterval(() => void load(), refreshMs)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [dashboard?.refresh_seconds])

  const pulse = dashboard?.pulse || {}
  const live = dashboard?.live_online || {}
  const pending = dashboard?.pending_actions || []
  const byRole = live.by_role || {}

  const roleLines = Object.entries(byRole)
    .filter(([, n]) => Number(n) > 0)
    .map(([role, n]) => ({ role, n: Number(n), label: ROLE_LABELS[role] || role }))

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">CEO Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            {new Date().toLocaleDateString('az-AZ', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
          <p className="text-xs text-gray-600 mt-1">Biznesin nəbzi — trafik analitikası ayrıca bölmədədir</p>
        </div>

        <Card className="p-4 !bg-[#0f1218] border-emerald-500/30 min-w-[240px] shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">Hazırda onlayn</span>
          </div>
          <div className="font-display font-bold text-4xl text-white tabular-nums">{fmt(live.users)}</div>
          <p className="text-xs text-gray-500 mt-1">
            Son {live.window_minutes || 1} dəq · cəmi {fmt(live.total)} (qonaq {fmt(live.guests)})
          </p>
          <div className="mt-3 space-y-1.5">
            {roleLines.length ? (
              roleLines.map(({ role, n, label }) => (
                <div key={role} className="flex justify-between text-sm">
                  <span className="text-gray-400 capitalize">{label}</span>
                  <span className="font-semibold text-white tabular-nums">{fmt(n)}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-600">Rol üzrə məlumat yoxdur</p>
            )}
          </div>
          <p className="text-[10px] text-gray-600 mt-3">Hər {dashboard?.refresh_seconds ?? 30} saniyədə yenilənir</p>
        </Card>
      </div>

      {err ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {err}
        </div>
      ) : null}

      {inventoryAlerts.length > 0 ? (
        <div className="space-y-2">
          {inventoryAlerts.map((a, i) => (
            <div
              key={`${a.kind}-${i}`}
              className={[
                'rounded-xl border px-4 py-3 text-sm flex flex-wrap items-center justify-between gap-2',
                a.level === 'critical'
                  ? 'border-rose-500/40 bg-rose-500/15 text-rose-100'
                  : 'border-amber-500/40 bg-amber-500/15 text-amber-100',
              ].join(' ')}
            >
              <span>{a.message}</span>
              <Link to="/admin/inventory" className="text-xs font-semibold underline hover:no-underline">
                Ehtiyatı yenilə →
              </Link>
            </div>
          ))}
        </div>
      ) : null}

      {loading ? (
        <div className="text-sm text-gray-500 py-16 text-center">Dashboard yüklənir…</div>
      ) : null}

      {!loading && dashboard ? (
        <>
          <section>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
              Bu gün · biznes KPI
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
              <PulseCard
                label="Yeni tələbələr"
                value={fmt(pulse.new_students_today)}
                sub="Bu gün qeydiyyat"
                accent="emerald"
              />
              <PulseCard
                label="Yeni müəllimlər"
                value={fmt(pulse.new_instructors_today)}
                sub="Bu gün qeydiyyat"
                accent="violet"
              />
              <PulseCard
                label="Aktiv istifadəçi"
                value={fmt(pulse.active_users_online)}
                sub="Onlayn (daxil olmuş)"
              />
              <PulseCard label="MRR" value={fmtMoney(pulse.mrr_azn)} sub="Aylıq təkrarlanan gəlir" accent="amber" />
              <PulseCard
                label="Ödənişli müəllim"
                value={fmt(pulse.active_paid_instructors)}
                sub="Aktiv abunə"
              />
              <PulseCard
                label="Konversiya"
                value={pulse.conversion_pct_today != null ? fmtPct(pulse.conversion_pct_today) : '—'}
                sub="Bu gün qeydiyyat ÷ ziyarətçi"
              />
            </div>
          </section>

          <section>
            <div className="flex flex-wrap items-end justify-between gap-2 mb-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Pending Actions
                </div>
                <p className="text-sm text-gray-400 mt-1">Bu səhər nəzərdən keçirməli olduğunuz işlər</p>
              </div>
              {dashboard.pending_total > 0 ? (
                <span className="text-xs font-bold rounded-full bg-amber-500/20 text-amber-200 px-3 py-1 tabular-nums">
                  {fmt(dashboard.pending_total)} ümumi
                </span>
              ) : (
                <span className="text-xs text-emerald-400 font-semibold">✓ Növbə boşdur</span>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {pending.map((item) => (
                <Link
                  key={item.key}
                  to={item.href}
                  className={`block rounded-2xl border p-4 transition-colors ${severityStyles(item.severity)}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-white text-sm">{item.label}</div>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">{item.description}</p>
                    </div>
                    <span
                      className={`shrink-0 min-w-[2.5rem] text-center rounded-xl px-2.5 py-1.5 text-lg font-bold tabular-nums ${severityBadge(item.severity, item.count)}`}
                    >
                      {fmt(item.count)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {dashboard.recent_today?.length ? (
            <Card className="p-5 !bg-[#0f1218] border-white/10">
              <h2 className="text-sm font-semibold text-white mb-1">Bu günün qeydiyyatları</h2>
              <p className="text-xs text-gray-500 mb-4">Son fəaliyyət axını</p>
              <div className="space-y-3">
                {dashboard.recent_today.map((u) => (
                  <div
                    key={u.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-white/5 last:border-0"
                  >
                    <div>
                      <div className="text-sm font-medium text-white">{u.full_name}</div>
                      <div className="text-xs text-gray-500 capitalize">{ROLE_LABELS[u.role] || u.role}</div>
                    </div>
                    <div className="text-xs text-gray-500">
                      {u.created_at
                        ? formatDistanceToNow(new Date(u.created_at), { addSuffix: true, locale: az })
                        : '—'}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          <div className="grid sm:grid-cols-2 gap-3 pt-2">
            <Link
              to="/admin/analytics"
              className="block rounded-2xl border border-white/10 bg-[#0f1218] p-5 hover:border-primary/40 transition-colors"
            >
              <h2 className="font-display font-bold text-base text-white">Analitika paneli</h2>
              <p className="text-sm text-gray-500 mt-1">
                Trafik, funnel, cihaz payı və detallı konversiya — ikinci plan
              </p>
              <span className="inline-block mt-3 text-sm font-semibold text-primary">Aç →</span>
            </Link>
            <Link
              to="/admin/inventory"
              className="block rounded-2xl border border-white/10 bg-[#0f1218] p-5 hover:border-primary/40 transition-colors"
            >
              <h2 className="font-display font-bold text-base text-white">SMS & Ehtiyat</h2>
              <p className="text-sm text-gray-500 mt-1">Provayder balansı və infrastruktur monitorinqi</p>
              <span className="inline-block mt-3 text-sm font-semibold text-primary">Aç →</span>
            </Link>
          </div>
        </>
      ) : null}
    </div>
  )
}
