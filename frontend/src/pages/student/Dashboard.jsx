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
import useUiStore from '../../hooks/useUi'

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

function ExamPieTooltip({ active, payload, theme }) {
  if (!active || !payload?.length) return null
  const entry = payload[0]
  const val = Number(entry?.value)
  const fullTitle = entry?.payload?.fullTitle ?? entry?.name ?? 'İmtahan'
  const isDark = theme === 'dark'

  return (
    <div
      className={`rounded-xl border px-3 py-2.5 text-xs shadow-lg max-w-[min(280px,90vw)] ${
        isDark
          ? 'border-white/15 bg-[#0b0b0b] text-slate-50'
          : 'border-slate-200 bg-white text-slate-900 shadow-slate-200/80'
      }`}
    >
      <p className={`text-[10px] font-bold uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        Bal
      </p>
      <p className={`mt-1 text-sm font-semibold leading-snug ${isDark ? 'text-white' : 'text-slate-900'}`}>
        {fullTitle}: {Number.isFinite(val) ? Math.round(val) : '—'}%
      </p>
    </div>
  )
}

export default function StudentDashboard() {
  const { user } = useAuthStore()
  const theme = useUiStore((s) => s.theme)
  const [exams, setExams] = useState([])

  const pieLabelStyle = useMemo(
    () => ({
      fill: theme === 'dark' ? '#f8fafc' : '#0f172a',
      fontSize: 11,
      fontWeight: 600,
    }),
    [theme],
  )

  const pieSliceStroke = theme === 'dark' ? 'rgba(15,12,41,0.9)' : 'rgba(255,255,255,0.85)'

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
                  label={{
                    ...pieLabelStyle,
                    formatter: (value) => `${Math.round(Number(value))}%`,
                  }}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke={pieSliceStroke} strokeWidth={1} />
                  ))}
                </Pie>
                <Tooltip content={(props) => <ExamPieTooltip {...props} theme={theme} />} />
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
