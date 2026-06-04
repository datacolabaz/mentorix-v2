import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../lib/api'
import Card from '../../components/common/Card'

const StatCard = ({ label, value, icon }) => (
  <Card className="p-5 !bg-[#F0F4F8] border-gray-200 shadow-[0_10px_30px_rgba(34,224,136,0.1)]">
    <div className="flex items-start justify-between">
      <div>
        <div className="text-xs font-semibold text-[#003366] uppercase tracking-wider mb-2">{label}</div>
        <div className="font-display font-extrabold text-3xl text-[#003366]">{value}</div>
      </div>
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl bg-gray-100 border border-gray-200">
        {icon}
      </div>
    </div>
  </Card>
)

function formatDay(d) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('az-AZ', { day: 'numeric', month: 'short' })
  } catch {
    return String(d)
  }
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [traffic, setTraffic] = useState(null)
  const [instructors, setInstructors] = useState([])
  const [inventoryAlerts, setInventoryAlerts] = useState([])
  const [inventory, setInventory] = useState(null)

  useEffect(() => {
    api.get('/admin/stats').then((d) => setStats(d.stats))
    api
      .get('/admin/analytics/traffic', { params: { days: 7 } })
      .then((d) => setTraffic(d.traffic || null))
      .catch(() => setTraffic(null))
    api.get('/admin/instructors').then((d) => setInstructors(d.instructors?.slice(0, 5) || []))
    api
      .get('/admin/billing/inventory')
      .then((d) => {
        setInventory(d.inventory || null)
        setInventoryAlerts(d.inventory?.alerts || [])
      })
      .catch(() => {
        setInventory(null)
        setInventoryAlerts([])
      })
  }, [])

  const display = inventory?.display
  const smsHas = Boolean(display?.sms_has_data)
  const stHas = Boolean(display?.storage_has_data)
  const t = traffic?.today || {}
  const dev = traffic?.devices_today || {}
  const share = traffic?.device_share_today || {}

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl">Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">{new Date().toLocaleDateString('az-AZ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      {inventoryAlerts.length > 0 ? (
        <div className="mb-4 space-y-2">
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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="SMS — qalan (provayder)"
          value={smsHas ? (display.sms_remaining ?? 0).toLocaleString('az-AZ') : 'Oxunmur'}
          icon="📱"
        />
        <StatCard
          label="SMS — ümumi (təxmini)"
          value={smsHas ? (display.sms_total ?? 0).toLocaleString('az-AZ') : '—'}
          icon="📦"
        />
        <StatCard
          label="Yaddaş — boş (disk)"
          value={
            display?.storage_has_limit && display.storage_remaining_mb != null
              ? `${display.storage_remaining_mb.toLocaleString('az-AZ')} MB`
              : stHas
                ? `${(display.storage_used_mb ?? 0).toLocaleString('az-AZ')} MB istifadə`
                : '—'
          }
          icon="💾"
        />
        <StatCard
          label="Yaddaş — ümumi limit"
          value={
            stHas && (display.storage_total_mb ?? 0) > 0
              ? `${(display.storage_total_mb ?? 0).toLocaleString('az-AZ')} MB`
              : '—'
          }
          icon="🗄️"
        />
      </div>
      {inventory && !smsHas ? (
        <p className="text-sm text-amber-200/90 mb-4 -mt-2">
          <Link to="/admin/inventory" className="underline font-semibold">
            SMS & Ehtiyat
          </Link>{' '}
          — SMS balansı gəlmirsə: eyni SMS_LOGIN/SMS_PASSWORD, Railway IP-ni sendsms/LSIM panelində icazəli edin
          (medpanel server IP icazəlidir). Opsional: SMS_QUICKSMS_BASE_URL=https://apps.lsim.az/quicksms
        </p>
      ) : null}

      <Card className="p-5 mb-6">
        <div className="flex flex-wrap items-end justify-between gap-2 mb-4">
          <div>
            <h2 className="font-display font-bold text-base">Giriş / çıxış (bu gün)</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Bakı vaxtı · mobil / kompüter girişləri üzrə
            </p>
          </div>
          {traffic ? (
            <span className="text-[11px] text-gray-500">Son 7 gün cədvəli aşağıda</span>
          ) : (
            <span className="text-[11px] text-amber-400">Statistika yüklənmədi (migrasiya 118?)</span>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
          <StatCard label="Giriş" value={t.logins_today ?? '—'} icon="↗️" />
          <StatCard label="Çıxış" value={t.logouts_today ?? '—'} icon="↘️" />
          <StatCard label="Unikal istifadəçi" value={t.unique_users_today ?? '—'} icon="👤" />
          <StatCard label="Hələ çıxmayan" value={t.still_logged_in_today ?? '—'} icon="🟢" />
          <StatCard label="Son 1 saat aktiv" value={t.active_last_hour ?? '—'} icon="⏱️" />
          <StatCard label="Landing baxış" value={t.landing_views_today ?? '—'} icon="🌐" />
        </div>
        <div className="grid sm:grid-cols-3 gap-3 text-sm">
          <div className="rounded-xl border border-white/10 bg-[#13112e] px-4 py-3">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Mobil giriş</div>
            <div className="font-semibold text-white">
              {dev.mobile ?? 0}
              {share.mobile_pct != null ? (
                <span className="text-gray-400 font-normal text-xs ml-1">({share.mobile_pct}%)</span>
              ) : null}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#13112e] px-4 py-3">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Kompüter giriş</div>
            <div className="font-semibold text-white">
              {dev.desktop ?? 0}
              {share.desktop_pct != null ? (
                <span className="text-gray-400 font-normal text-xs ml-1">({share.desktop_pct}%)</span>
              ) : null}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#13112e] px-4 py-3">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Planşet / digər</div>
            <div className="font-semibold text-white">
              {(dev.tablet ?? 0) + (dev.unknown ?? 0)}
              {share.tablet_pct != null ? (
                <span className="text-gray-400 font-normal text-xs ml-1">(planşet {share.tablet_pct}%)</span>
              ) : null}
            </div>
          </div>
        </div>
        {traffic?.daily?.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="text-gray-500 border-b border-white/10">
                  <th className="py-2 pr-3 font-semibold">Gün</th>
                  <th className="py-2 pr-3 font-semibold">Giriş</th>
                  <th className="py-2 pr-3 font-semibold">Çıxış</th>
                  <th className="py-2 pr-3 font-semibold">Unikal</th>
                  <th className="py-2 pr-3 font-semibold">Mobil</th>
                  <th className="py-2 font-semibold">Kompüter</th>
                </tr>
              </thead>
              <tbody>
                {traffic.daily.map((row) => (
                  <tr key={String(row.day)} className="border-b border-white/5 text-gray-300">
                    <td className="py-2 pr-3">{formatDay(row.day)}</td>
                    <td className="py-2 pr-3 tabular-nums">{row.logins}</td>
                    <td className="py-2 pr-3 tabular-nums">{row.logouts}</td>
                    <td className="py-2 pr-3 tabular-nums">{row.unique_users}</td>
                    <td className="py-2 pr-3 tabular-nums">{row.logins_mobile}</td>
                    <td className="py-2 tabular-nums">{row.logins_desktop}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Müəllimlər" value={stats?.instructors ?? '—'} icon="👨‍🏫" />
        <StatCard label="Tələbələr" value={stats?.students ?? '—'} icon="🎓" />
        <StatCard label="Qruplar" value={stats?.classes ?? '—'} icon="📚" />
        <StatCard label="Aktiv abunə" value={stats?.subscriptions ?? '—'} icon="⭐" />
        <StatCard
          label="Gəlir (cəmi)"
          value={
            stats
              ? `₼${Number(stats.revenue || 0).toLocaleString('az-AZ', { maximumFractionDigits: 0 })}`
              : '—'
          }
          icon="💰"
        />
        <StatCard label="İmtahanlar" value={stats?.exams ?? '—'} icon="📝" />
        <StatCard label="Bağlı tələbə" value={stats?.students_enrolled ?? '—'} icon="🔗" />
        <StatCard label="Təyin olunmamış" value={stats?.students_unassigned ?? '—'} icon="⚠️" />
      </div>

      <Card className="p-5">
        <h2 className="font-display font-bold text-base mb-4">Son Müəllimlər</h2>
        <div className="space-y-3">
          {instructors.map((i) => (
            <div key={i.id} className="flex items-center gap-3 p-3 bg-[#13112e] rounded-xl">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-sm font-bold">
                {i.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold">{i.full_name}</div>
                <div className="text-xs text-gray-400">{i.subject || '—'} • {i.student_count} tələbə</div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-400">
                  SMS: {i.sms_used_monthly ?? 0}/{i.sms_limit_monthly ?? '∞'}
                </span>
                <span className={`px-2 py-0.5 rounded-full ${i.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                  {i.is_active ? 'Aktiv' : 'Deaktiv'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
