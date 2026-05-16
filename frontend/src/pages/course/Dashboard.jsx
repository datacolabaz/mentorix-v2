import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import KpiCard from '../../components/common/KpiCard'
import useAuthStore from '../../hooks/useAuth'
import CourseSetupModal from '../../components/course/CourseSetupModal'

const QUICK_LINKS = [
  { to: '/course/leads', label: 'Lidlər', desc: 'Qəbul və sınaq dərs izləmə' },
  { to: '/course/teachers', label: 'Müəllimlər', desc: 'Kursda işləyən heyət' },
  { to: '/course/students', label: 'Tələbələr', desc: 'Qeydiyyatlı şagirdlər' },
  { to: '/course/groups', label: 'Qruplar', desc: 'Sinif və otaqlar' },
]

const EMPTY_STATS = {
  lessons_today: 0,
  active_teachers: 0,
  active_students: 0,
  active_groups: 0,
  pending_payments: 0,
  leads_new: 0,
  leads_total: 0,
  needs_branding: false,
  course_name: '',
}

function formatAzn(amount) {
  const n = Number(amount)
  if (!Number.isFinite(n)) return '0 ₼'
  return `${n.toLocaleString('az-AZ', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ₼`
}

export default function CourseDashboard() {
  const { user } = useAuthStore()
  const [stats, setStats] = useState(EMPTY_STATS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [setupOpen, setSetupOpen] = useState(false)

  const courseName = stats.course_name || user?.course_name || user?.full_name || 'Kursunuz'

  const loadStats = () => {
    setLoading(true)
    setError(null)
    return api
      .get('/course/dashboard-stats')
      .then((res) => {
        const next = { ...EMPTY_STATS, ...(res.stats || {}) }
        setStats(next)
        if (next.needs_branding) setSetupOpen(true)
      })
      .catch((err) => {
        setError(err?.response?.data?.message || err?.message || 'Statistika yüklənmədi')
        setStats(EMPTY_STATS)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    api
      .get('/course/dashboard-stats')
      .then((res) => {
        if (cancelled) return
        const next = { ...EMPTY_STATS, ...(res.stats || {}) }
        setStats(next)
        if (next.needs_branding) setSetupOpen(true)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err?.response?.data?.message || err?.message || 'Statistika yüklənmədi')
        setStats(EMPTY_STATS)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const onSetupComplete = () => {
    setSetupOpen(false)
    void loadStats()
  }

  return (
    <div className="p-4 sm:p-6 min-w-0 max-w-6xl mx-auto w-full space-y-6">
      <CourseSetupModal open={setupOpen} onComplete={onSetupComplete} />

      <div>
        <h1 className="font-display font-bold text-xl sm:text-2xl text-token-textMain tracking-tight">Dashboard</h1>
        <p className="text-token-textMuted text-sm mt-1">
          <span className="text-emerald-400/95 font-medium">{courseName}</span>
        </p>
        {error ? (
          <p className="text-sm text-red-300/90 mt-2" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Yeni lid"
          value={loading ? '…' : String(stats.leads_new ?? 0)}
          secondary={loading ? '' : `${stats.leads_total ?? 0} cəmi lead`}
        />
        <KpiCard
          title="Kurs tələbəsi"
          value={loading ? '…' : String(stats.active_students ?? 0)}
          secondary={loading ? '' : 'qeydiyyatlı şagirdlər'}
        />
        <KpiCard
          title="Müəllim heyəti"
          value={loading ? '…' : String(stats.active_teachers ?? 0)}
          secondary={loading ? '' : 'əlavə edilmiş işçilər'}
        />
        <KpiCard
          title="Gözləyən ödəniş"
          value={loading ? '…' : formatAzn(stats.pending_payments)}
          secondary={loading ? '' : 'kurs tələbələri üzrə'}
        />
      </div>

      <Card className="p-5 border border-indigo-500/20 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-indigo-200/90">Sürətli keçidlər</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {QUICK_LINKS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:border-primary/40 hover:bg-primary/5 transition-colors"
            >
              <div className="text-sm font-semibold text-white">{item.label}</div>
              <div className="text-xs text-token-textMuted mt-1">{item.desc}</div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  )
}
