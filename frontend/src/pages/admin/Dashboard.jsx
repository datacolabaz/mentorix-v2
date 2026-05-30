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

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [instructors, setInstructors] = useState([])
  const [inventoryAlerts, setInventoryAlerts] = useState([])
  const [inventory, setInventory] = useState(null)

  useEffect(() => {
    api.get('/admin/stats').then((d) => setStats(d.stats))
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
                  {i.is_active ? '