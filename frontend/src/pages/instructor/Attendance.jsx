import { useEffect, useMemo, useState } from 'react'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
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

function ymdTodayBaku() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Baku',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function sliceYmd(v) {
  if (v == null || v === '') return null
  const s = String(v)
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : null
}

function normalizeWeekdays(raw) {
  if (raw == null || raw === '') return []
  let arr = raw
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw)
    } catch {
      return []
    }
  }
  if (!Array.isArray(arr)) return []
  const set = new Set()
  for (const x of arr) {
    const d = parseInt(String(x), 10)
    if (Number.isFinite(d) && d >= 1 && d <= 7) set.add(d)
  }
  return [...set].sort((a, b) => a - b)
}

/** UTC gün @ noon — YYYY-MM-DD müqayisəsi üçün */
function parseYmdUtcNoon(ymd) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
}

/** getUTCDay(): Bazar=0 → bizim B.e.=1 modeli */
function isoDowMon1(d) {
  const w = d.getUTCDay()
  return w === 0 ? 7 : w
}

function countLessonDaysBetween(startYmd, endYmd, weekdayIds) {
  const days = normalizeWeekdays(weekdayIds)
  if (!days.length || !startYmd || !endYmd || startYmd > endYmd) return 0
  let cur = parseYmdUtcNoon(startYmd)
  const end = parseYmdUtcNoon(endYmd)
  if (!cur || !end) return 0
  let n = 0
  while (cur <= end) {
    if (days.includes(isoDowMon1(cur))) n += 1
    cur = new Date(cur.getTime() + 86400000)
  }
  return n
}

function addDaysToYmd(ymd, deltaDays) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  dt.setUTCDate(dt.getUTCDate() + Number(deltaDays))
  return dt.toISOString().slice(0, 10)
}

function fmtDdMmFromYmd(ymd) {
  if (!ymd) return '—'
  const [a, b, c] = ymd.split('-')
  return `${c}.${b}.${a}`
}

export default function InstructorAttendance() {
  const [students, setStudents] = useState([])
  const [enrollmentId, setEnrollmentId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [period, setPeriod] = useState(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkFrom, setBulkFrom] = useState('')
  const [bulkTo, setBulkTo] = useState('')
  const [bulkNotes, setBulkNotes] = useState('')
  const [bulkSaving, setBulkSaving] = useState(false)
  const [monthlyRows, setMonthlyRows] = useState([])
  const [monthlyMeta, setMonthlyMeta] = useState({
    next: null,
    next_status: null,
    anchor: null,
    today: null,
  })
  const [monthlyFetching, setMonthlyFetching] = useState(false)
  const [monthlyActFrom, setMonthlyActFrom] = useState('')
  const [monthlyActTo, setMonthlyActTo] = useState('')
  const [monthlyRangeEnd, setMonthlyRangeEnd] = useState(() => ymdTodayBaku())
  const toast = useToast()

  useEffect(() => {
    api
      .get('/students')
      .then((d) => setStudents(d.students || []))
      .catch(() => setStudents([]))
  }, [])

  useEffect(() => {
    setMonthlyRangeEnd(ymdTodayBaku())
    setMonthlyRows([])
    setMonthlyActFrom('')
    setMonthlyActTo('')
  }, [enrollmentId])

  const loadMonthlySlots = async (id) => {
    if (!id) return
    setMonthlyFetching(true)
    try {
      const d = await api.get('/attendance/monthly/' + encodeURIComponent(id))
      setMonthlyRows(Array.isArray(d.slots) ? d.slots : [])
      const nl = d.next_lesson
      const nextDate =
        nl && typeof nl === 'object' && nl.lesson_date
          ? nl.lesson_date
          : typeof nl === 'string'
            ? nl
            : null
      setMonthlyMeta({
        next: nextDate,
        next_status: nl && typeof nl === 'object' ? nl.status || null : null,
        anchor: d.anchor_date || null,
        today: d.today_baku || null,
      })
    } catch (err) {
      setMonthlyRows([])
      toast(err.message || 'Aylıq davamiyyət yüklənmədi', 'error')
    } finally {
      setMonthlyFetching(false)
    }
  }

  const loadPeriod = async (id) => {
    if (!id) return
    setLoading(true)
    try {
      const d = await api.get('/attendance/period/' + encodeURIComponent(id))
      setPeriod(d)
      if (d?.enrollment?.billing_type === 'monthly') {
        await loadMonthlySlots(id)
      } else {
        setMonthlyRows([])
      }
    } catch (err) {
      setPeriod(null)
      setMonthlyRows([])
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

  const monthlyLessonStats = useMemo(() => {
    const en = period?.enrollment
    if (!en || en.billing_type !== 'monthly') return null
    const anchor = sliceYmd(en.enrollment_start_date) || sliceYmd(en.enrolled_at)
    const end = monthlyRangeEnd || ymdTodayBaku()
    if (!anchor) return null
    const safeEnd = end < anchor ? anchor : end
    const n = countLessonDaysBetween(anchor, safeEnd, en.lesson_weekdays)
    return { anchor, end: safeEnd, count: n }
  }, [period, monthlyRangeEnd])

  useEffect(() => {
    if (monthlyLessonStats?.anchor) {
      setMonthlyActFrom(monthlyLessonStats.anchor)
      setMonthlyActTo(monthlyLessonStats.end)
    }
  }, [monthlyLessonStats?.anchor, monthlyLessonStats?.end])

  const submitBulk = async () => {
    if (!enrollmentId) return
    if (!bulkFrom || !bulkTo) {
      toast('Tarix aralığını seçin', 'error')
      return
    }
    if (bulkFrom > bulkTo) {
      toast('Başlanğıc tarixi bitirmə tarixindən sonra ola bilməz', 'error')
      return
    }
    setBulkSaving(true)
    try {
      const d = await api.post('/attendance/period/bulk-fill', {
        enrollment_id: enrollmentId,
        date_from: bulkFrom,
        date_to: bulkTo,
        attended: true,
        notes: bulkNotes.trim() || undefined,
      })
      const n = d?.updated ?? 0
      toast(n ? `${n} dərs üçün qeyd yaradıldı` : d?.message || 'Dərs tapılmadı', n ? 'success' : 'info')
      setBulkOpen(false)
      setBulkNotes('')
      await loadPeriod(enrollmentId)
    } catch (err) {
      toast(err?.message || 'Xəta', 'error')
    } finally {
      setBulkSaving(false)
    }
  }

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

  const monthlyGenerateFuture = async () => {
    if (!enrollmentId) return
    setMonthlyFetching(true)
    try {
      await api.post('/attendance/monthly/' + encodeURIComponent(enrollmentId) + '/generate', {})
      toast('Gələcək dərs günləri üçün slotlar yeniləndi')
      await loadMonthlySlots(enrollmentId)
    } catch (e) {
      toast(e?.message || 'Xəta', 'error')
    } finally {
      setMonthlyFetching(false)
    }
  }

  const monthlyBulkAction = async (action) => {
    if (!enrollmentId || !monthlyActFrom || !monthlyActTo) {
      toast('Aralıq tarixləri seçin', 'error')
      return
    }
    if (monthlyActFrom > monthlyActTo) {
      toast('Tarix aralığı yanlışdır', 'error')
      return
    }
    setMonthlyFetching(true)
    try {
      const d = await api.post('/attendance/monthly/' + encodeURIComponent(enrollmentId) + '/bulk', {
        date_from: monthlyActFrom,
        date_to: monthlyActTo,
        action,
      })
      toast(`${d?.updated ?? 0} gün yeniləndi`, 'success')
      await loadMonthlySlots(enrollmentId)
    } catch (e) {
      toast(e?.message || 'Xəta', 'error')
    } finally {
      setMonthlyFetching(false)
    }
  }

  const monthlyArchiveAllPast = async () => {
    if (!enrollmentId) return
    const anchor = monthlyMeta.anchor || monthlyLessonStats?.anchor
    const today = monthlyMeta.today || ymdTodayBaku()
    if (!anchor) return
    const yest = addDaysToYmd(today, -1)
    if (!yest || yest < anchor) {
      toast('Arxivlənəcək keçmiş tarix yoxdur', 'info')
      return
    }
    if (!window.confirm(`${anchor} – ${yest} aralığındakı bütün dərs günlərini arxivləmək?`)) return
    setMonthlyFetching(true)
    try {
      await api.post('/attendance/monthly/' + encodeURIComponent(enrollmentId) + '/bulk', {
        date_from: anchor,
        date_to: yest,
        action: 'archived',
      })
      toast('Keçmiş tarixlər arxivləndi')
      await loadMonthlySlots(enrollmentId)
    } catch (e) {
      toast(e?.message || 'Xəta', 'error')
    } finally {
      setMonthlyFetching(false)
    }
  }

  const putMonthlySlot = async (lessonDate, status, opts = {}) => {
    if (!enrollmentId) return
    setMonthlyFetching(true)
    try {
      await api.put('/attendance/monthly/' + encodeURIComponent(enrollmentId) + '/day', {
        lesson_date: lessonDate,
        status,
        ...(opts.chargeAbsence ? { charge_absence: true } : {}),
      })
      await loadMonthlySlots(enrollmentId)
      toast('Yadda saxlandı', 'success')
    } catch (e) {
      toast(e?.message || 'Xəta', 'error')
    } finally {
      setMonthlyFetching(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 min-w-0">
      <h1 className="font-display font-bold text-xl sm:text-2xl mb-6 break-words">Davamiyyət Qeydi</h1>

      <div className="max-w-4xl w-full min-w-0">
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
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-gray-500 leading-snug">
                  Keçmiş tarixlər üçün planlaşdırılmış dərsləri bir dəfədə &quot;Gəldi&quot; kimi qeyd edin (cari dövr,
                  dərs günləri cədvəldəki tarixlər əsasında).
                </p>
                <Button type="button" size="sm" variant="secondary" disabled={!enrollmentId} onClick={() => setBulkOpen(true)}>
                  Toplu qeyd
                </Button>
              </div>
              {Array.from({ length: period.enrollment.lesson_limit }, (_, i) => i + 1).map((n) => {
                const row = (period.attendance || []).find((a) => Number(a.lesson_number) === n)
                const status = row ? (row.attended ? 'attended' : 'absent') : 'empty'
                const planned = (period.lessons || []).find((l) => Number(l.lesson_number) === n)
                const plannedStr = planned?.starts_at ? fmtAzBakuDateTime(planned.starts_at) : '—'
                const isPast = n < currentLessonNumber
                const isCurrent = n === currentLessonNumber
                const isFuture = n > currentLessonNumber
                const disabled = saving || isFuture

                const containerCls = [
                  'flex items-center justify-between gap-2 rounded-xl px-3 py-2 border',
                  isCurrent
                    ? 'bg-[#13112e] border-indigo-400/60 ring-2 ring-indigo-500/25'
                    : isPast
                      ? 'bg-[#0f0c29]/80 border-indigo-500/10 opacity-95'
                      : 'bg-[#13112e] border-indigo-500/10 opacity-60',
                ].join(' ')

                return (
                  <div
                    key={n}
                    className={containerCls}
                  >
                    <div className="text-sm text-gray-200 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-gray-400 shrink-0">Dərs {n}</span>
                        {isCurrent && <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-indigo-500/15 border border-indigo-400/35 text-indigo-200 shrink-0">Cari</span>}
                        {status === 'attended' && <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-400/35 text-emerald-200 shrink-0">Gəldi</span>}
                        {status === 'absent' && <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-red-500/10 border border-red-400/30 text-red-200 shrink-0">Gəlmədi</span>}
                        {isFuture && <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-gray-500/10 border border-white/10 text-gray-300 shrink-0">Növbəti</span>}
                      </div>
                      <div className="text-xs text-gray-500 font-mono tabular-nums mt-1 truncate">
                        {plannedStr}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={status === 'attended' ? 'primary' : 'secondary'}
                        onClick={() => void setLesson(n, true)}
                        loading={saving}
                        disabled={disabled}
                      >
                        ✓ Gəldi
                      </Button>
                      <Button
                        size="sm"
                        variant={status === 'absent' ? 'danger' : 'secondary'}
                        onClick={() => void setLesson(n, false)}
                        loading={saving}
                        disabled={disabled}
                      >
                        ✗ Gəlmədi
                      </Button>
                    </div>
                  </div>
                )
              })}
              <p className="text-[11px] text-gray-500">
                Hər dərs üçün “Gəldi/Gəlmədi” seçə bilərsiniz. Paket (8/12) tamamlananda sistem avtomatik növbəti dövrü açır.
              </p>
            </div>
          ) : enrollmentId && period?.enrollment?.billing_type === 'monthly' ? (
            <div className="rounded-xl border border-indigo-500/20 bg-[#0f0c29]/60 p-4 space-y-4">
              <p className="text-xs text-gray-300 leading-relaxed">
                <span className="font-semibold text-indigo-200">Aylıq paket:</span> hər keçmiş dərs üçün virtual
                balansda borc (aylıq məbləğ ÷ 8) yazılır: <strong>Gəldi</strong> həmişə sayılır;{' '}
                <strong>Gəlmədi</strong> ödənişsiz qayıb kimi sayılmır; <strong>Ödənişli qayıb</strong> dərs qiyməti
                tutulur. Gələcək tarixlər üçün düymələr deaktivdir.
              </p>
              {monthlyMeta.next && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                  <span className="font-semibold">Növbəti dərs:</span>{' '}
                  <span className="font-mono">{fmtDdMmFromYmd(monthlyMeta.next)}</span>
                  {monthlyMeta.next_status && monthlyMeta.next_status !== 'pending' && (
                    <span className="text-emerald-200/80"> ({monthlyMeta.next_status})</span>
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  loading={monthlyFetching}
                  onClick={() => void monthlyGenerateFuture()}
                >
                  Slotları yenilə (gələcək)
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={monthlyFetching}
                  onClick={() => void monthlyArchiveAllPast()}
                >
                  Bütün keçmişi arxivlə
                </Button>
              </div>
              {monthlyLessonStats && (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                    <div className="flex-1 min-w-0">
                      <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                        Hesab intervalının sonu (Bakı tarixi)
                      </label>
                      <input
                        type="date"
                        className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-blue-500"
                        value={monthlyRangeEnd}
                        min={monthlyLessonStats.anchor}
                        max={ymdTodayBaku()}
                        onChange={(e) => setMonthlyRangeEnd(e.target.value)}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">
                    Ödəniş başlanğıcı:{' '}
                    <span className="font-mono text-white">{monthlyLessonStats.anchor}</span>
                    {' → '}
                    <span className="font-mono text-white">{monthlyLessonStats.end}</span>
                    {' · '}
                    <span className="text-emerald-300 font-semibold">{monthlyLessonStats.count}</span> dərs günü
                    (seçilmiş həftəlik cədvələ uyğun)
                  </p>
                </>
              )}
              <div className="rounded-lg border border-indigo-500/15 bg-[#13112e]/40 p-3 space-y-3">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Toplu əməliyyat aralığı</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1">Başlanğıc</label>
                    <input
                      type="date"
                      className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-blue-500"
                      value={monthlyActFrom}
                      min={monthlyLessonStats?.anchor}
                      max={monthlyActTo || undefined}
                      onChange={(e) => setMonthlyActFrom(e.target.value)}
                      disabled={monthlyFetching}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1">Son</label>
                    <input
                      type="date"
                      className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-blue-500"
                      value={monthlyActTo}
                      min={monthlyActFrom || monthlyLessonStats?.anchor}
                      onChange={(e) => setMonthlyActTo(e.target.value)}
                      disabled={monthlyFetching}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    loading={monthlyFetching}
                    onClick={() => void monthlyBulkAction('attended')}
                  >
                    Aralığı &quot;Gəldi&quot; et
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    loading={monthlyFetching}
                    onClick={() => void monthlyBulkAction('absent')}
                  >
                    Aralığı &quot;Gəlmədi&quot; et
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    loading={monthlyFetching}
                    onClick={() => void monthlyBulkAction('archived')}
                  >
                    Aralığı arxivlə
                  </Button>
                </div>
              </div>
              <div className="overflow-x-auto rounded-lg border border-indigo-500/15">
                <table className="min-w-full text-xs">
                  <thead className="bg-[#13112e]/80 text-gray-400">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold">Tarix</th>
                      <th className="text-left px-3 py-2 font-semibold">Status</th>
                      <th className="text-right px-3 py-2 font-semibold">Əməliyyat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyRows.length === 0 && !monthlyFetching && (
                      <tr>
                        <td colSpan={3} className="px-3 py-4 text-gray-500 text-center">
                          Slot yoxdur. &quot;Slotları yenilə&quot; düyməsini sıxın.
                        </td>
                      </tr>
                    )}
                    {monthlyRows.map((row) => {
                      const clipToday = monthlyMeta.today || ymdTodayBaku()
                      const isFutureRow = row.lesson_date > clipToday
                      const rowActionsDisabled = monthlyFetching || isFutureRow
                      return (
                      <tr key={row.lesson_date} className="border-t border-indigo-500/10">
                        <td className="px-3 py-2 font-mono text-white whitespace-nowrap">
                          {fmtDdMmFromYmd(row.lesson_date)}
                          {isFutureRow && (
                            <span className="block text-[10px] text-gray-500 font-sans normal-case mt-0.5">
                              gələcək
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-300 capitalize">{row.status || 'pending'}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <div className="inline-flex flex-wrap justify-end gap-1">
                            <Button
                              type="button"
                              size="sm"
                              disabled={rowActionsDisabled}
                              onClick={() => void putMonthlySlot(row.lesson_date, 'attended')}
                            >
                              Gəldi
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={rowActionsDisabled}
                              onClick={() => void putMonthlySlot(row.lesson_date, 'absent')}
                            >
                              Gəlmədi
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={rowActionsDisabled}
                              onClick={() => void putMonthlySlot(row.lesson_date, 'absent', { chargeAbsence: true })}
                              title="Dərs ödənişli sayılır (virtual balans)"
                            >
                              Ödənişli qayıb
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={rowActionsDisabled}
                              onClick={() => void putMonthlySlot(row.lesson_date, 'archived')}
                            >
                              Arxiv
                            </Button>
                          </div>
                        </td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : enrollmentId ? (
            <p className="text-xs text-gray-500">Bu paket üçün məlumat yüklənmədi.</p>
          ) : null}
        </Card>
      </div>

      <Modal
        open={bulkOpen}
        onClose={() => !bulkSaving && setBulkOpen(false)}
        title="Toplu davamiyyət (Gəldi)"
        size="md"
      >
        <div className="space-y-4 text-sm">
          <p className="text-xs text-gray-400 leading-relaxed">
            Seçilmiş tarix aralığında cədvəldə olan hər dərs üçün (cari dövr) davamiyyət &quot;Gəldi&quot; kimi yazılır.
            Yalnız bu dövrə aid planlaşdırılmış tarixlər nəzərə alınır.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Başlanğıc</label>
              <input
                type="date"
                className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white outline-none focus:border-blue-500"
                value={bulkFrom}
                onChange={(e) => setBulkFrom(e.target.value)}
                disabled={bulkSaving}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Son</label>
              <input
                type="date"
                className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white outline-none focus:border-blue-500"
                value={bulkTo}
                onChange={(e) => setBulkTo(e.target.value)}
                disabled={bulkSaving}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Qeyd (istəyə bağlı)</label>
            <input
              className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white outline-none focus:border-blue-500"
              placeholder="Məs: köhnə dövr köçürməsi"
              value={bulkNotes}
              onChange={(e) => setBulkNotes(e.target.value)}
              disabled={bulkSaving}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" disabled={bulkSaving} onClick={() => setBulkOpen(false)}>
              Ləğv
            </Button>
            <Button type="button" loading={bulkSaving} onClick={() => void submitBulk()}>
              Tətbiq et
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
