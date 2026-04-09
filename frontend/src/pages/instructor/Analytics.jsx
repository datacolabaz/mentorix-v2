import { useEffect, useState } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import api from '../../lib/api'
import Card from '../../components/common/Card'

const COLORS = ['#e1306c', '#1877f2', '#000', '#3b82f6', '#6366f1']

export default function InstructorAnalytics() {
  const [students, setStudents] = useState([])

  useEffect(() => {
    api.get('/students').then(d => setStudents(d.students || []))
  }, [])

  const referralData = students.reduce((acc, s) => {
    const src = s.referral_source || 'Digər'
    acc[src] = (acc[src] || 0) + 1
    return acc
  }, {})

  const pieData = Object.entries(referralData).map(([name, value]) => ({ name, value }))

  const barData = students.map(s => ({
    name: s.full_name.split(' ')[0],
    bal: parseFloat(s.avg_score || 0),
    ders: s.lesson_count || 0,
  }))

  return (
    <div className="p-6">
      <h1 className="font-display font-bold text-2xl mb-6">Analitika</h1>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <Card className="p-5">
          <h2 className="font-display font-bold text-base mb-4">Tələbə Performansı</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={barData}>
              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} domain={[0, 100]} />
              <Tooltip contentStyle={{ background: '#1a1740', border: '1px solid rgba(99,102,241,.3)', borderRadius: 8 }} />
              <Bar dataKey="bal" fill="#3b82f6" radius={[6, 6, 0, 0]} name="Orta Bal" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h2 className="font-display font-bold text-base mb-4">Yönləndirmə Mənbəyi</h2>
          {pieData.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#1a1740', border: '1px solid rgba(99,102,241,.3)', borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-52 flex items-center justify-center text-gray-500">Məlumat yoxdur</div>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="font-display font-bold text-base mb-4">Dərs Sayı</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={barData}>
            <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
            <Tooltip contentStyle={{ background: '#1a1740', border: '1px solid rgba(99,102,241,.3)', borderRadius: 8 }} />
            <Bar dataKey="ders" fill="#10b981" radius={[6, 6, 0, 0]} name="Dərs sayı" />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  )
}
