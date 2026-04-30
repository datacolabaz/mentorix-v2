import { useEffect, useMemo, useState } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import useAuthStore from '../../hooks/useAuth'

const PIE_COLORS = [
  '#3b82f6',
  '#8b5cf6',
  '#06b6d4',
  '#10b981',
  '#f59e0b',
  '#ec4899',
  '#6366f1',
  '#14b8a6',
]

function truncate(str, n) {
  const s = String(str || '').trim()
  if (s.length <= n) return s
  return `${s.slice(0, n - 1)}…`
}

export default function StudentDashboard() {
  const { user } = useAuthStore()
  const [exams, setExams] = useState([])

  useEffect(() => {
    if (!user?.id) return
    api
      .get('/exams/my')
      .then((d) => {
        const raw = d?.exams
        setExams(Array.isArray(raw) ? raw.filter((x) => x != null && x.id != null) : [])
      })
      .catch(() => setExams([]))
  }, [user?.id])

  const pieData = useMemo(() => {
    const done = (exams || []).filter(
      (e) => e && e.submitted_at && e.score != null && e.score !== ''
    )
    return done
      .map((e) => {
        const v = Number(e.score)
        if (!Number.isFinite(v)) return null
        const clamped = Math.max(0, Math.min(100, v))
        return {
          name: truncate(e.title, 22),
          fullTitle: e.title || 'İmtahan',
          value: clamped,
        }
      })
      .filter(Boolean)
  }, [exams])

  return (
    <div className="p-4 sm:p-6 w-full min-w-0 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl break-words text-token-textMain pl-20 sm:pl-0">
          Salam, {user?.full_name?.split(' ')[0]}! 👋
        </h1>
        <p className="text-token-textMuted text-sm mt-1 pl-20 sm:pl-0">Proqresinizə baxın</p>
      </div>

      <Card hover className="p-5 min-w-0 overflow-hidden border border-[color:var(--border-subtle)] hover:border-primary/20">
        <h2 className="font-display font-bold text-base mb-1 text-token-textMain">📊 İmtahan balları</h2>
        <p className="text-xs text-token-textMuted mb-4">
          Tamamladığınız hər imtahan üçün bal payı (böyük dilim = daha yüksək bal nisbəti)
        </p>
        {pieData.length ? (
          <div className="w-full h-[min(360px,55vw)] min-h-[260px] max-w-md mx-auto">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={88}
                  paddingAngle={2}
                  label={({ value }) => `${Math.round(value)}%`}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="rgba(15,12,41,0.9)" strokeWidth={1} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: '#1a1740',
                    border: '1px solid rgba(99,102,241,.35)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(val, _name, props) => {
                    const title = props?.payload?.fullTitle ?? 'İmtahan'
                    return [`${title}: ${Math.round(Number(val))}%`, 'Bal']
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11 }}
                  formatter={(value) => <span className="text-token-textMuted">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-48 flex items-center justify-center text-token-textMuted text-sm text-center px-4">
            Hələ tamamlanmış imtahan balı yoxdur
          </div>
        )}
      </Card>
    </div>
  )
}
