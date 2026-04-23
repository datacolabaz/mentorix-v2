import { useEffect, useState } from 'react'
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

  useEffect(() => {
    api.get('/admin/stats').then((d) => setStats(d.stats))
    api.get('/admin/instructors').then((d) => setInstructors(d.instructors?.slice(0, 5) || []))
  }, [])

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl">Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">{new Date().toLocaleDateString('az-AZ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Müəllimlər" value={stats?.instructors ?? '—'} icon="👨‍🏫" />
        <StatCard label="Tələbələr" value={stats?.students ?? '—'} icon="🎓" />
        <StatCard label="Gəlir" value={stats ? `₼${stats.revenue}` : '—'} icon="💰" />
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
                <span className="text-gray-400">SMS: {i.sms_used}/{i.sms_limit}</span>
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
