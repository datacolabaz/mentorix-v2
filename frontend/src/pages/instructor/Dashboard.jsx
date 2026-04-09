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
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    api.get('/students').then(d => setStudents(d.students || []))
    api.get('/auth/me').then(d => {
      // instructor profile ucun admin endpointden al
    })
  }, [])

  const hrs = new Date().getHours()
  const greeting = hrs < 12 ? 'Sabahınız xeyir' : hrs < 18 ? 'Günortanız xeyir' : 'Axşamınız xeyir'

  const avgScore = students.length
    ? Math.round(students.filter(s => s.avg_score).reduce((a, s) => a + parseFloat(s.avg_score || 0), 0) / students.filter(s => s.avg_score).length) || 0
    : 0

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl">
          {greeting}, {user?.full_name?.split(' ')[0]}! 👋
        </h1>
        <p className="text-gray-400 text-sm mt-1">Bugünün xülasəsi</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Tələbə" value={students.length} icon="🎓" color="text-blue-400" />
        <StatCard label="Orta Bal" value={`${avgScore}%`} icon="📊" color="text-emerald-400" />
        <StatCard label="Bu ay dərs" value="—" icon="✅" color="text-yellow-400" />
        <StatCard label="Gəlir" value="₼0" icon="💰" color="text-cyan-400" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <Card className="p-5">
            <h2 className="font-display font-bold text-base mb-4">Tələbə Proqresi</h2>
            {students.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={students.slice(0, 10).map(s => ({ name: s.full_name.split(' ')[0], bal: s.avg_score || 0 }))}>
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip contentStyle={{ background: '#1a1740', border: '1px solid rgba(99,102,241,.3)', borderRadius: 8 }} />
                  <Line type="monotone" dataKey="bal" stroke="#3b82f6" strokeWidth={2.5} dot={{ fill: '#3b82f6' }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-52 flex items-center justify-center text-gray-500">Hələ məlumat yoxdur</div>
            )}
          </Card>
        </div>

        <Card className="p-5">
          <h2 className="font-display font-bold text-base mb-4">Top Tələbələr</h2>
          <div className="space-y-3">
            {students
              .filter(s => s.avg_score)
              .sort((a, b) => b.avg_score - a.avg_score)
              .slice(0, 5)
              .map((s, i) => (
                <div key={s.id} className="flex items-center gap-3">
                  <span className="text-sm font-bold text-gray-500 w-4">{i + 1}</span>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{s.full_name}</div>
                    <div className="h-1.5 bg-[#13112e] rounded-full mt-1">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${s.avg_score}%` }} />
                    </div>
                  </div>
                  <span className="text-sm font-bold text-blue-400">{s.avg_score}%</span>
                </div>
              ))}
            {!students.filter(s => s.avg_score).length && (
              <div className="text-center text-gray-500 text-sm py-8">Hələ bal yoxdur</div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
