import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import useAuthStore from '../../hooks/useAuth'

export default function StudentDashboard() {
  const { user } = useAuthStore()
  const [data, setData] = useState(null)
  const [attendance, setAttendance] = useState([])

  useEffect(() => {
    api.get('/students/' + user.id).then(d => setData(d.student))
  }, [])

  const BILLING = { '8_lessons': '8 Dərs', '12_lessons': '12 Dərs', monthly: 'Aylıq' }
  const limit = data?.billing_type === '8_lessons' ? 8 : data?.billing_type === '12_lessons' ? 12 : null

  const chartData = attendance.filter(a => a.session_score).map(a => ({
    ders: `D${a.lesson_number}`,
    bal: a.session_score,
  }))

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl">Salam, {user?.full_name?.split(' ')[0]}! 👋</h1>
        <p className="text-gray-400 text-sm mt-1">Proqresinizə baxın</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="p-5">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Tamamlanan Dərs</div>
          <div className="font-display font-extrabold text-3xl text-blue-400">
            {data?.lesson_count || 0}{limit ? `/${limit}` : ''}
          </div>
          {limit && (
            <div className="mt-3">
              <div className="h-2 bg-[#13112e] rounded-full">
                <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${Math.min(100, ((data?.lesson_count || 0) / limit) * 100)}%` }} />
              </div>
            </div>
          )}
        </Card>
        <Card className="p-5">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Billing</div>
          <div className="font-display font-bold text-xl text-emerald-400">{BILLING[data?.billing_type] || '—'}</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Müəllim</div>
          <div className="font-display font-bold text-xl text-yellow-400">{data?.instructor_name || '—'}</div>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="font-display font-bold text-base mb-4">📈 Bal Dinamikası</h2>
        {chartData.length ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <XAxis dataKey="ders" tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} domain={[0, 100]} />
              <Tooltip contentStyle={{ background: '#1a1740', border: '1px solid rgba(99,102,241,.3)', borderRadius: 8 }} />
              <Line type="monotone" dataKey="bal" stroke="#3b82f6" strokeWidth={2.5} dot={{ fill: '#3b82f6' }} name="Bal" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-48 flex items-center justify-center text-gray-500">Hələ dərs qeyd edilməyib</div>
        )}
      </Card>
    </div>
  )
}
