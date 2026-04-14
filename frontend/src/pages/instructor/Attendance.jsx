import { useEffect, useMemo, useState } from 'react'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'

function billingLabel(t) {
  if (t === '8_lessons') return '8 dərs'
  if (t === '12_lessons') return '12 dərs'
  if (t === 'monthly') return 'Aylıq'
  return t || '—'
}

function fmtAzBakuDateTime(dt) {
  if (!dt) return '—'
  const d = new Date(dt)
  if (Number.isNaN(d.getTime())) return '—'
  const parts = new Intl.DateTimeFormat('az-AZ', {
    timeZone: 'Asia/Baku',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d)
  const get = (t) => parts.find((p) => p.type === t)?.value
  const dd = get('day')
  const mm = get('month')
  const yyyy = get('year')
  const hh = get('hour')
  const mi = get('minute')
  if (!dd || !mm || !yyyy) return '—'
  return `${dd}.${mm}.${yyyy} - ${hh || '00'}:${mi || '00'}`
}

export default function InstructorAttendance() {
  const [students, setStudents] = useState([])
  const [enrollmentId, setEnrollmentId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [period, setPeriod] = useState(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  useEffect(() => {
    api
      .get('/students')
      .then((d) => setStudents(d.students || []))
      .catch(() => setStudents([]))
  }, [])

  const loadPeriod = async (id) => {
    if (!id) return
    setLoading(true)
    try {
      const d = await api.get('/attendance/period/' + encodeURIComponent(id))
      setPeriod(d)
    } catch (err) {
      setPeriod(null)
      toast(err.message || 'Yüklənmədi', 'error')
    } finally {
      setLoading(false)
    }
  }

  const currentLessonNumber = useMemo(() => {
    const limit = period?.enrollment?.lesson_limit
    const done = period?.enrollment?.lesson_count || 0
    const n = done + 1
    if (!limit) return n
    return Math.min(n, limit)
  }, [period])

  const setLesson = async (lessonNumber, attended) => {
    if (!enrollmentId) return
    // Optimistic UI: dərs sayğacı və status dərhal yenilənsin
    setPeriod((p) => {
      if (!p?.enrollment) return p
      const cycle = p.enrollment.billing_cycle
      const nextAttendance = Array.isArray(p.attendance) ? [...p.attendance] : []
      const idx = nextAttendance.findIndex((a) => Number(a.lesson_number) === Number(lessonNumber))
      const row = {
        ...(idx >= 0 ? nextAttendance[idx] : {}),
        lesson_number: lessonNumber,
        billing_cycle: cycle,
        attended: Boolean(attended),
      }
      if (idx >= 0) nextAttendance[idx] = row
      else nextAttendance.push(row)
      nextAttendance.sort((a, b) => Number(a.lesson_number) - Number(b.lesson_number))
      const nextCount = nextAttendance.length
      return { ...p, enrollment: { ...p.enrollment, lesson_count: nextCount }, attendance: nextAttendance }
    })

    setSaving(true)
    try {
      await api.put('/attendance/period/' + encodeURIComponent(enrollmentId), {
        lesson_number: lessonNumber,
        attended,
        date,
        notes,
      })
      setNotes('')
      await loadPeriod(enrollmentId)
      toast('Yadda saxlandı', 'success')
    } catch (err) {
      // rollback by reloading server state
      await loadPeriod(enrollmentId)
      toast(err.message || 'Xəta', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 min-w-0">
      <h1 className="font-display font-bold text-xl sm:text-2xl mb-6 break-words">Davamiyyət Qeydi</h1>

      <div className="max-w-lg w-full min-w-0">
        <Card className="p-4 sm:p-6 space-y-4 min-w-0 overflow-hidden">
          <div className="min-w-0">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Tələbə</label>
            <select className="w-full min-w-0 max-w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-3 sm:px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500"
              value={enrollmentId} onChange={async (e) => {
                const id = e.target.value
                setEnrollmentId(id)
                setPeriod(null)
                if (id) await loadPeriod(id)
              }}>
              <option value="">— Tələbə seçin —</option>
              {students.map(s => (
                <option key={s.enrollment_id} value={s.enrollment_id}>{s.full_name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Tarix</label>
              <input
                type="date"
                className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={!enrollmentId}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Qeyd (opsional)</label>
              <input
                placeholder="Əlavə qeyd..."
                className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={!enrollmentId}
              />
            </div>
          </div>

          {loading && <p className="text-xs text-gray-500">Yüklənir…</p>}

          {period?.enrollment && (
            <div className="rounded-xl border border-indigo-500/20 bg-[#0f0c29]/60 p-3">
              <p className="text-xs text-gray-400">
                <span className="text-gray-500">Paket:</span>{' '}
                <span className="text-white font-semibold">{billingLabel(period.enrollment.billing_type)}</span>{' '}
                · <span className="text-gray-500">Dövr:</span>{' '}
                <span className="text-white font-semibold">#{period.enrollment.billing_cycle}</span>
              </p>
              {period.enrollment.lesson_limit != null && (
                <p className="text-xs text-gray-500 mt-1">
                  Dərslər: {period.enrollment.lesson_count || 0} / {period.enrollment.lesson_limit}
                </p>
              )}
            </div>
          )}

          {period?.enrollment?.lesson_limit != null ? (
            <div className="space-y-2">
              {Array.from({ length: period.enrollment.lesson_limit }, (_, i) => i + 1).map((n) => {
                const row = (period.attendance || []).find((a) => Number(a.lesson_number) === n)
 