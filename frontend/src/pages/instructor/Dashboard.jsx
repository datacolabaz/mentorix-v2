import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import useAuthStore from '../../hooks/useAuth'

const StatCard = ({ label, value, icon, color }) => (
  <Card className="p-5">
    <div className="flex items-start justify-between">
      <div>
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{label}</div>
        <div className={`font-display font-extrabold text-3xl ${color}`}>{value}</div>
      </div>
      <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-2xl">{icon}</div>
    </div>
  </Card>
)

export default function InstructorDashboard() {
  const { user } = useAuthStore()
  const [students, setStudents] = useState([])

  useEffect(() => {
    api.get('/students').then(d => setStudents(d.students || []))
  }, [])

  const hrs = new Date().getHours()
  const greeting = hrs < 12 ? 'Sabahınız xeyir' : hrs < 18 ? 'Günortanız xeyir' : 'Axşamınız xeyir'

  const avgScore = students.length
    ? Math.round(students.filter(s => s.avg_score).reduce((a, s) => a + parseFloat(s.avg_score || 0), 0) / students.filter(s => s.avg_score).length) || 0
    : 0

  const chartRows = students.slice(0, 10).map((s) => {
    const first = s.full_name?.split(' ')?.[0] || '—'
    const bal = s.avg_score != null && s.avg_score !== '' ? Number(s.avg_score) : 0
    return { name: first.length > 12 ? `${first.slice(0, 11)}…` : first, bal }
  })

  const topSorted = [...students].sort((a, b) => {
    const sa = a.avg_score != null && a.avg_score !== '' ? Number(a.avg_score) : -1
    const sb = b.avg_score != null && b.avg_score !== '' ? Number(b.avg_score) : -1
    return sb - sa
  })

  return (
    <div className="p-4 sm:p-6 min-w-0">
      <div className="mb-6">
        <h1 className="font-display font-bold text-xl sm:text-2xl break-words">
          {greeting}, {user?.full_name?.split(' ')[0]}! 👋
        </h1>
        <p className="text-gray-400 text-sm mt-1">Bugünün xülasəsi</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard label="Tələbə" value={students.length} icon="🎓" color="text-blue-400" />
        <StatCard label="Orta Bal" value={`${avgScore}%`} icon="📊" color="text-emerald-400" />
        <StatCard label="Bu ay dərs" value="—" icon="✅" color="text-yellow-400" />
        <StatCard label="Gəlir" value="₼0" icon="💰" color="text-cyan-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-w-0">
        <div className="lg:col-span-2 min-w-0">
          <Card className="p-4 sm:p-5 min-w-0 overflow-hidden">
            <h2 className="font-display font-bold text-base mb-4">Tələbə Proqresi</h2>
            {students.length ? (
              <div className="w-full h-[220px] min-h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={56} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 11 }} domain={[0, 100]} width={32} />
                    <Tooltip contentStyle={{ background: '#1a1740', border: '1px solid rgba(99,102,241,.3)', borderRadius: 8 }} />
                    <Line type="monotone" dataKey="bal" stroke="#3b82f6" strokeWidth={2.5} dot={{ fill: '#3b82f6' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-52 flex items-center justify-center text-gray-500">Hələ məlumat yoxdur</div>
            )}
            {students.length > 0 && !students.some((s) => s.avg_score != null && s.avg_score !== '') && (
              <p className="text-gray-500 text-xs mt-2">
                Dərs balı qeyd edildikcə xətt yenilənəcək (Davamiyyət → Bal).
              </p>
            )}
          </Card>
        </div>

        <Card className="p-4 sm:p-5 min-w-0">
          <h2 className="font-display font-bold text-base mb-4">Top Tələbələr</h2>
          <div className="space-y-3">
            {topSorted.slice(0, 5).map((s, i) => {
              const hasScore = s.avg_score != null && s.avg_score !== ''
              const pct = hasScore ? Number(s.avg_score) : 0
              return (
                <div key={s.enrollment_id || s.id} className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <span className="text-sm font-bold text-gray-500 w-5 shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{s.full_name}</div>
                    <div className="h-1.5 bg-[#13112e] rounded-full mt-1">
                      <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: hasScore ? `${pct}%` : '0%' }} />
                    </div>
                  </div>
                  <span className="text-sm font-bold text-blue-400 shrink-0 tabular-nums">
                    {hasScore ? `${pct}%` : '—'}
                  </span>
                </div>
              )
            })}
            {!students.length && (
              <div className="text-center text-gray-500 text-sm py-8">Hələ tələbə yoxdur</div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
