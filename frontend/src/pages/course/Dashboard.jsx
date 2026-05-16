import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import KpiCard from '../../components/common/KpiCard'
import useAuthStore from '../../hooks/useAuth'

const QUICK_LINKS = [
  { to: '/course/teachers', label: 'Müəllim əlavə et', desc: 'Kursda işləyən müəllimlər' },
  { to: '/course/students', label: 'Tələbə bazası', desc: 'Ümumi şagird siyahısı' },
  { to: '/course/groups', label: 'Qrup yarat', desc: 'Sinif və qrup təyinatı' },
  { to: '/course/finance', label: 'Ödənişlər', desc: 'Borc və paketlər' },
]

const EMPTY_STATS = {
  lessons_today: 0,
  active_teachers: 0,
  active_students: 0,
  active_groups: 0,
  pending_payments: 0,
}

function formatAzn(amount) {
  const n = Number(amount)
  if (!Number.isFinite(n)) return '0 ₼'
  return `${n.toLocaleString('az-AZ', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ₼`
}

function lessonLabel(count) {
  const n = Number(count) || 0
  if (n === 1) return '1 dərs bu gün'
  return `${n} dərs bu gün`
}

export default function CourseDashboard() {
  const { user } = useAuthStore()
  const courseName = user?.course_name || user?.full_name || 'Kursunuz'
  const [stats, setStats] = useState(EMPTY_STATS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    api
      .get('/course/dashboard-stats')
      .then((res) => {
        if (cancelled) return
        setStats({ ...EMPTY_STATS, ...(res.stats || {}) })
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

  return (
    <div className="p-4 sm:p-6 min-w-0 max-w-6xl mx-auto w-full space-y-6">
      <div>
        <h1 className="font-display font-bold text-xl sm:text-2xl text-token-textMain tracking-tight">Dashboard</h1>
        <p className="text-token-textMuted text-sm mt-1">
          <span className="text-emerald-400/95 font-medium">{courseName}</span> — ümumi vəziyyət və qısayollar
        </p>
        {error ? (
          <p className="text-sm text-red-300/90 mt-2" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
    