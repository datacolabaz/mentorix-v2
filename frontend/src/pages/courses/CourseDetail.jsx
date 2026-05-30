import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import ListSkeleton from '../../components/common/ListSkeleton'
import { WEEKDAYS } from '../instructor/Schedule'

function formatAzn(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '0 ₼'
  return `${v.toLocaleString('az-AZ', { maximumFractionDigits: 2 })} ₼`
}

function scheduleLabel(wdays, times) {
  let days = wdays
  if (typeof days === 'string') {
    try {
      days = JSON.parse(days)
    } catch {
      days = []
    }
  }
  if (!Array.isArray(days) || !days.length) return 'Cədvəl təyin edilməyib'
  let t = times
  if (typeof t === 'string') {
    try {
      t = JSON.parse(t)
    } catch {
      t = {}
    }
  }
  return days
    .map((v) => {
      const d = WEEKDAYS.find((x) => x.v === Number(v))
      const hm = t?.[String(v)] || ''
      return hm ? `${d?.short || v} ${hm}` : d?.short || v
    })
    .join(' · ')
}

export default function CourseDetail() {
  const { id } = useParams()
  const [course, setCourse] = useState(null)
  const [loading, setLoading] = useState(true)
  const [assignable, setAssignable] = useState([])
  const [pickIds, setPickIds] = useState([])
  const [assignBusy, setAssignBusy] = useState(false)

  function load() {
    setLoading(true)
    api
      .get(`/courses/${id}`)
      .then((res) => setCourse(res.course))
      .catch(() => setCourse(null))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    api
      .get('/courses/assignable-students')
      .then((res) => setAssignable(res.students || []))
      .catch(() => setAssignable([]))
  }, [id])

  async function assignStudents() {
    if (!pickIds.length) return
    setAssignBusy(true)
    try {
      const res = await api.post(`/courses/${id}/students`, { student_ids: pickIds })
      setCourse(res.course)
      setPickIds([])
    } finally {
      setAssignBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <ListSkeleton />
      </div>
    )
  }

  if (!course) {
    return (
      <div className="p-4 sm:p-6">
        <p className="text-red-300">Fənn kartı tapılmadı</p>
        <Link to="/courses" className="text-emerald-400 text-sm mt-2 inline-block">
          ← Fənn kataloquna qayıt
        </Link>
      </div>
    )
  }

  const linkedIds = new Set((course.students || []).map((s) => String(s.id)))

  return (
    <div className="p-4 sm:p-6 min-w-0 max-w-6xl mx-auto w-full space-y-6">
      <div>
        <Link to="/courses" className="text-xs text-emerald-400/90 hover:text-emerald-300">
          ← Fənn kataloqu
        </Link>
        <h1 className="font-display font-bold text-2xl text-token-textMain mt-2">{course.name}</h1>
        <p className="text-token-textMuted text-sm mt-1">
          Müəllim: <span className="text-white">{course.instructor_name || '—'}</span>
          {' · '}
          Cədvəl: {scheduleLabel(course.lesson_weekdays, course.lesson_times)}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 border border-white/10">
          <div className="text-xs text-token-textMuted uppercase">Tələbə (bu fənn)</div>
          <div className="text-2xl font-bold text-white tabular-nums">{course.student_count ?? 0}</div>
        </Card>
        <Card className="p-4 border border-white/10">
          <div className="text-xs text-token-textMuted uppercase">Aylıq ödəniş</div>
          <div className="text-2xl font-bold text-emerald-300 tabular-nums">
            {course.monthly_fee != null ? formatAzn(course.monthly_fee) : '—'}
          </div>
        </Card>
        <Card className="p-4 border border-white/10">
          <div className="text-xs text-token-textMuted uppercase">Gözlənən borc</div>
          <div className="text-2xl font-bold text-white tabular-nums">
            {formatAzn(course.pending_payments)}
          </div>
        </Card>
      </div>

      <Card className="p-5 border border-indigo-500/20 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-indigo-200/90">Tələbələr</h2>
        {(course.students || []).length === 0 ? (
          <p className="text-sm text-token-textMuted">
            Bu fənn kartına hələ heç kim təyin olunmayıb. «Tələbələrim»dəki tələbələri aşağıdan seçib əlavə edin.
          </p>
        ) : (
          <ul className="divide-y divide-white/5">
            {course.students.map((s) => (
              <li key={s.id} className="py-2 flex justify-between gap-2 text-sm">
                <span className="text-white">{s.full_name}</span>
                <span className="text-token-textMuted tabular-nums">{s.phone || ''}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="border-t border-white/10 pt-4 space-y-2">
          <p className="text-xs text-token-textMuted">Kursa tələbə əlavə et</p>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {assignable
              .filter((s) => !linkedIds.has(String(s.id)))
              .map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pickIds.includes(String(s.id))}
                    onChange={() => {
                      const key = String(s.id)
                      setPickIds((prev) =>
                        prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key],
                      )
                    }}
                  />
                  <span>{s.full_name}</span>
                </label>
              ))}
          </div>
          <Button type="button" disabled={assignBusy || !pickIds.length} onClick={assignStudents}>
            Seçilənləri əlavə et
          </Button>
        </div>
      </Card>

      <Card className="p-5 border border-white/10 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-token-textMuted">Ödənişlər</h2>
        {(course.payments || []).length === 0 ? (
          <p className="text-sm text-token-textMuted">Ödəniş qeydi yoxdur</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {course.payments.map((p) => (
              <li key={p.id} className="flex justify-between gap-2">
                <span className="text-white">{p.student_name || '—'}</span>
                <span className="text-emerald-300 tabular-nums">{formatAzn(p.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5 border border-white/10 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-token-textMuted">Davamiyyət</h2>
        {(course.attendance || []).length === 0 ? (
          <p className="text-sm text-token-textMuted">Son dərs qeydi yoxdur</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {course.attendance.map((a) => (
              <li key={a.id} className="flex justify-between gap-2">
                <span className="text-white">{a.student_name}</span>
                <span className="text-token-textMuted">
                  {a.lesson_date ? String(a.lesson_date).slice(0, 10) : '—'} · {a.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
