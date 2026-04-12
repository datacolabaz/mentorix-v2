import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import api from '../../lib/api'
import Card from '../../components/common/Card'

const COLORS = ['#e1306c', '#1877f2', '#000', '#3b82f6', '#6366f1']

export default function InstructorAnalytics() {
  const [students, setStudents] = useState([])

  useEffect(() => {
    api
      .get('/students')
      .then((d) => setStudents(d.students || []))
      .catch(() => setStudents([]))
  }, [])

  const referralData = students.reduce((acc, s) => {
    const src = s.referral_source || 'Digər'
    acc[src] = (acc[src] || 0) + 1
    return acc
  }, {})

  const pieData = Object.entries(referralData).map(([name, value]) => ({ name, value }))

  const barData = students.map(s => ({
    name: (s.full_name?.split(' ')?.[0] || '—').length > 10
      ? `${(s.full_name?.split(' ')?.[0] || '').slice(0, 9)}…`
      : (s.full_name?.split(' ')?.[0] || '—'),
    bal: parseFloat(s.avg_score || 0),
    ders: s.lesson_count || 0,
  }))

  return (
    <div className="p-4 sm:p-6 min-w-0">
      <h1 className="font-display font-bold text-xl sm:text-2xl mb-6">Analitika</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4 min-w-0">
        <Card className="p-4 sm:p-5 min-w-0 overflow-hidden">
          <h2 className="font-display font-bold text-base mb-4">Tələbə Performansı</h2>
          <div className="w-full h-[240px] min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={48} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} domain={[0, 100]} width={36} />
                <Tooltip contentStyle={{ background: '#1a1740', border: '1px solid rgba(99,102,241,.3)', borderRadius: 8 }} />
                <Bar dataKey="bal" fill="#3b82f6" radius={[6, 6, 0, 0]} name="Orta Bal" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4 sm:p-5 min-w-0 overflow-hidden">
          <h2 className="font-display font-bold text-base mb-4">Yönləndirmə Mənbəyi</h2>
          {pieData.length ? (
            <div className="w-full h-[240px] min-h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius="45%"
                    outerRadius="75%"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1a1740', border: '1px solid rgba(99,102,241,.3)', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-52 flex items-center justify-center text-gray-500">Məlumat yoxdur</div>
          )}
        </Card>
      </div>

      <Card className="p-4 sm:p-5 min-w-0 overflow-hidden">
        <h2 className="font-display font-bold text-base mb-4">Dərs Sayı</h2>
        <div className="w-full h-[200px] min-h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={48} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} width={36} />
              <Tooltip contentStyle={{ background: '#1a1740', border: '1px solid rgba(99,102,241,.3)', borderRadius: 8 }} />
              <Bar dataKey="ders" fill="#10b981" radius={[6, 6, 0, 0]} name="Dərs sayı" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  )
}
