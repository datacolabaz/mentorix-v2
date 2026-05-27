import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
import Button from '../../components/common/Button'
import useAuthStore from '../../hooks/useAuth'
import useUiStore from '../../hooks/useUi'
import GroupSwitcher from '../../components/student/GroupSwitcher'
import { useStudentGroups } from '../../contexts/StudentGroupContext'
import { withEnrollmentQuery } from '../../lib/studentGroupQuery'

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

const StatMini = ({ label, value, hint }) => (
  <div className="rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceCard/50 p-4">
    <div className="text-[10px] font-bold uppercase tracking-wider text-token-textMuted">{label}</div>
    <div className="font-display font-extrabold text-2xl text-token-textMain mt-1">{value}</div>
    {hint && <div className="text-[11px] text-token-textMuted mt-1">{hint}</div>}
  </div>
)

export default function StudentDashboard() {
  const { user } = useAuthStore()
  const theme = useUiStore((s) => s.theme)
  const navigate = useNavigate()
  const { activeEnrollmentId, activeEnrollment, enrollments, hasGroups } = useStudentGroups()
  const [exams, setExams] = useState([])
  const [overview, setOverview] = useState(null)

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
    const examPath = withEnrollmentQuery('/exams/my', activeEnrollmentId)
    api
      .get(examPath)
      .then((d) => {
        const raw = d?.exams
        setExams(Array.isArray(raw) ? raw.filter((x) => x != null && x.id != null) : [])
      })
      .catch(() => setExams([]))
  }, [user?.id, activeEnrollmentId])

  useEffect(() => {
    api
      .get('/students/my/overview')
      .then((d) => setOverview(d))
      .catch(() => setOverview(null))
  }, [enrollments.length])

  const groupStats = useMemo(() => {
    if (!overview?.by_group || !activeEnrollmentId) return null
    return overview.by_group.find((g) => String(g.enrollment_id) === String(activeEnrollmentId))
  }, [overview, activeEnrollmentId])

  const pieData = useMemo(() => {
    const done = (exams || []).filter(
      (e) => e && e.submitted_at && e.score != null && e.score !== '',
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
      <div className="mb-6 pl-14 sm:pl-0">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-2xl break-words text-token-textMain">
              Salam, {user?.full_name?.split(' ')[0]}! 👋
            </h1>
            <p className="text-token-textMuted text-sm mt-1">
              {activeEnrollment
                ? `${activeEnrollment.group_name} • ${activeEnrollment.instructor_name}`
                : 'Proqresinizə baxın'}
            </p>
          </div>
          <GroupSwitcher className="w-full sm:w-auto sm:min-w-[220px]" />
        </div>
      </div>

      {!hasGroups && (
        <Card className="p-6 mb-6 border border-dashed border-primary/30 bg-primary/5">
          <h2 className="font-display font-bold text-base text-token-textMain">Hələ qrupa qoşulmamısınız</h2>
          <p className="text-sm text-token-textMuted mt-2">
            Müəllimin verdiyi join kodu ilə qrupa qoşulun (məs: MX-97762).
          </p>
          <Button className="mt-4" onClick={() => navigate('/student/join')}>
            Join kod daxil et
          </Button>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatMini
          label="Qruplarım"
          value={overview?.groups_count ?? enrollments.length ?? '—'}
        />
        <StatMini
          label="Gözləyən tapşırıq"
          value={groupStats?.pending_tasks ?? overview?.pending_tasks_total ?? '—'}
          hint={activeEnrollment ? 'Seçilmiş qrup' : 'Hamısı'}
        />
        <StatMini
          label="Yaxın imtahan"
          value={groupStats?.upcoming_exams ?? overview?.upcoming_exams_total ?? '—'}
          hint={activeEnrollment ? 'Seçilmiş qrup' : 'Hamısı'}
        />
        <StatMini
          label="Orta bal"
          value={
            groupStats?.avg_score != null
              ? `${groupStats.avg_score}%`
              : overview?.avg_score_overall != null
                ? `${overview.avg_score_overall}%`
                : '—'
          }
          hint={activeEnrollment ? activeEnrollment.subject_name : undefined}
        />
      </div>

      {enrollments.length > 1 && (
        <Card className="p-4 mb-6 border border-[color:var(--border-subtle)]">
          <div className="text-xs font-semibold uppercase tracking-wider text-token-textMuted mb-3">
            Qruplarınız
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {enrollments.map((g) => (
              <Link
                key={g.enrollment_id}
                to="/student/groups"
                className="flex items-center gap-3 p-3 rounded-xl border border-[color:var(--border-subtle)] hover:border-primary/30 transition-colors"
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: g.color }}
                />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-token-textMain truncate">
                    {g.group_name}
                  </div>
                  <div className="text-xs text-token-textMuted truncate">{g.instructor_name}</div>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}

      <Card hover className="p-5 min-w-0 overflow-hidden border border-[color:var(--border-subtle)] hover:border-primary/20">
        <h2 className="font-display font-bold text-base mb-1 text-token-textMain">
          📊 İmtahan balları
          {activeEnrollment?.group_name && (
            <span className="text-token-textMuted font-normal text-sm ml-2">
              — {activeEnrollment.group_name}
            </span>
          )}
        </h2>
        <p className="text-xs text-token-textMuted mb-4">
          Seçilmiş qrupun tamamlanmış imtahanları
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
          <div className="h-48 flex flex-col items-center justify-center text-token-textMuted text-sm text-center px-4 gap-3">
            <span>
              {hasGroups
                ? 'Bu qrup üçün hələ tamamlanmış imtahan yoxdur'
                : 'Qrupa qoşulduqdan sonra imtahanlar burada görünəcək'}
            </span>
            {hasGroups && (
              <Button size="sm" variant="secondary" onClick={() => navigate('/student/exams')}>
                İmtahanlara bax
              </Button>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
