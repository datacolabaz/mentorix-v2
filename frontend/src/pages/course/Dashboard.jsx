import { Link } from 'react-router-dom'
import Card from '../../components/common/Card'
import KpiCard from '../../components/common/KpiCard'
import useAuthStore from '../../hooks/useAuth'

const QUICK_LINKS = [
  { to: '/course/teachers', label: 'Müəllim əlavə et', desc: 'Kursda işləyən müəllimlər' },
  { to: '/course/students', label: 'Tələbə bazası', desc: 'Ümumi şagird siyahısı' },
  { to: '/course/groups', label: 'Qrup yarat', desc: 'Sinif və qrup təyinatı' },
  { to: '/course/finance', label: 'Ödənişlər', desc: 'Borc və paketlər' },
]

export default function CourseDashboard() {
  const { user } = useAuthStore()
  const courseName = user?.course_name || user?.full_name || 'Kursunuz'

  return (
    <div className="p-4 sm:p-6 min-w-0 max-w-6xl mx-auto w-full space-y-6">
      <div>
        <h1 className="font-display font-bold text-xl sm:text-2xl text-token-textMain tracking-tight">Dashboard</h1>
        <p className="text-token-textMuted text-sm mt-1">
          <span className="text-emerald-400/95 font-medium">{courseName}</span> — ümumi vəziyyət və qısayollar
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Bu gün dərs" value="—" secondary="Tezliklə" />
        <KpiCard title="Aktiv müəllim" value="—" secondary="Tezliklə" />
        <KpiCard title="Aktiv tələbə" value="—" secondary="Tezliklə" />
        <KpiCard title="Gözləyən ödəniş" value="—" secondary="Tezliklə" />
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

      <Card className="p-5 border border-emerald-500/20 bg-emerald-500/[0.04]">
        <p className="text-sm text-token-textMuted leading-relaxed">
          Kurs paneli hazırdır. Növbəti mərhələdə müəllimlər, qruplar, cədvəl və maliyyə modulları tam CRM funksiyası ilə
          əlavə olunacaq.
        </p>
      </Car