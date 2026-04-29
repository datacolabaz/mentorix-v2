import { useEffect, useMemo, useState } from 'react'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
import { useToast } from '../../components/common/Toast'
import useUiStore from '../../hooks/useUi'

function billingLabel(t) {
  if (t === '8_lessons') return '8 dərs'
  if (t === '12_lessons') return '12 dərs'
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
  const { theme } = useUiStore()

  const labelCls = [
    'block text-xs font-semibold uppercase tracking-wider mb-2',
    theme === 'dark' ? 'text-gray-400' : 'text-token-textMuted',
  ].join(' ')

  const inputCls = [
    'w-full min-w-0 max-w-full box-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500 border',
    theme === 'dark'
      ? 'bg-[#13112e] border-indigo-500/20 text-white placeholder:text-gray-500'
      : 'bg-token-surfaceMain border-[color:var(--border-subtle)] text-token-textMain placeholder:text-token-textMuted',
  ].join(' ')

  const selectCls = [
    'w-full min-w-0 max-w-full rounded-xl px-3 sm:px-4 py-2.5 text-sm outline-none focus:border-blue-500 border',
    theme === 'dark'
      ? 'bg-[#13112e] border-indigo-500/20 text-white'
      : 'bg-token-surfaceMain border-[color:var(--border-subtle)] text-token-textMain',
  ].join(' ')

  const smallLabelCls = [
    'block text-[10px] font-semibold uppercase tracking-wider mb-1',
    theme === 'dark' ? 'text-gray-500' : 'text-token-textMuted',
  ].join(' ')

  const smallInputCls = [
    'w-full rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500 border',
    theme === 'dark'
      ? 'bg-[#13112e] border-indigo-500/20 text-white placeholder:text-gray-500'
      : 'bg-token-surfaceMain border-[color:var(--border-subtle)] text-token-textMain placeholder:text-token-textMuted',
  ].join(' ')

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
    // Monthly attendance removed (billing is pack-only now).
    void id
    setMonthlyRows([])
  }

  const loadPeriod = async (id) => {
    if (!id) return
    setLoading(true)
    try {
      const d = await api.get('/attendance/period/' + encodeURIComponent(id))
      setPeriod(d)
      setMonthlyRows([])
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
    void en
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
    // Monthly attendance removed.
    void enrollmentId
  }

  const monthlyBulkAction = async (action) => {
    void action
  }

  const monthlyArchiveAllPast = async () => {
    void enrollmentId
  }

  const putMonthlySlot = async (lessonDate, status, opts = {}) => {
    void lessonDate
    void status
    void opts
  }

  return (
    <div className="p-4 sm:p-6 min-w-0">
      <h1 className="font-display font-bold text-xl sm:text-2xl mb-6 break-words">Davamiyyət Qeydi</h1>

      <div className="max-w-4xl w-full min-w-0">
        <Card className="p-4 sm:p-6 space-y-4 min-w-0 overflow-hidden">
          <div className="min-w-0">
            <label className={labelCls}>Tələbə</label>
            <select
              className={selectCls}
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
              <label className={labelCls}>Tarix</label>
              <input
                type="date"
                className={['date-input-class', inputCls].join(' ')}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={!enrollmentId}
              />
            </div>
            <div>
              <label className={labelCls}>Qeyd (opsional)</label>
              <input
                placeholder="Əlavə qeyd..."
                className={inputCls}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={!enrollmentId}
              />
            </div>
          </div>

          {loading && (
            <p className={['text-xs', theme === 'dark' ? 'text-gray-500' : 'text-token-textMuted'].join(' ')}>
              Yüklənir…
            </p>
          )}

          {period?.enrollment && (
            <div
              className={[
                'rounded-xl border p-3',
                theme === 'dark'
                  ? 'border-indigo-500/20 bg-[#0f0c29]/60'
                  : 'border-[color:var(--border-subtle)] bg-token-surfaceMain/60',
              ].join(' ')}
            >
              <p className={['text-xs', theme === 'dark' ? 'text-gray-400' : 'text-token-textMuted'].join(' ')}>
                <span className={theme === 'dark' ? 'text-gray-500' : 'text-token-textMuted'}>Paket:</span>{' '}
                <span className={['font-semibold', theme === 'dark' ? 'text-white' : 'text-token-textMain'].join(' ')}>
                  {billingLabel(period.enrollment.billing_type)}
                </span>{' '}
                · <span className={theme === 'dark' ? 'text-gray-500' : 'text-token-textMuted'}>Dövr:</span>{' '}
                <span className={['font-semibold', theme === 'dark' ? 'text-white' : 'text-token-textMain'].join(' ')}>
                  #{period.enrollment.billing_cycle}
                </span>
              </p>
              {period.enrollment.lesson_limit != null && (
                <p className={['text-xs mt-1', theme === 'dark' ? 'text-gray-500' : 'text-token-textMuted'].join(' ')}>
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
                  theme === 'dark'
                    ? isCurrent
                      ? 'bg-[#13112e] border-indigo-400/60 ring-2 ring-indigo-500/25'
                      : isPast
                        ? 'bg-[#0f0c29]/80 border-indigo-500/10 opacity-95'
                        : 'bg-[#13112e] border-indigo-500/10 opacity-60'
                    : isCurrent
                      ? 'bg-token-surfaceMain border-[color:var(--border-subtle)] ring-2 ring-emerald-500/20'
                      : isPast
                        ? 'bg-token-surfaceMain/70 border-[color:var(--border-subtle)]'
                        : 'bg-token-surfaceMain/50 border-[color:var(--border-subtle)] opacity-70',
                ].join(' ')

                return (
                  <div
                    key={n}
                    className={containerCls}
                  >
                    <div className={['text-sm min-w-0', theme === 'dark' ? 'text-gray-200' : 'text-token-textMain'].join(' ')}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={['shrink-0', theme === 'dark' ? 'text-gray-400' : 'text-token-textMuted'].join(' ')}>
                          Dərs {n}
                        </span>
                        {isCurrent && (
                          <span
                            className={[
                              'text-[10px] font-bold px-2 py-0.5 rounded-lg shrink-0 border',
                              theme === 'dark'
                                ? 'bg-indigo-500/15 border-indigo-400/35 text-indigo-200'
                                : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-700',
                            ].join(' ')}
                          >
                            Cari
                          </span>
                        )}
                        {status === 'attended' && (
                          <span
                            className={[
                              'text-[10px] font-bold px-2 py-0.5 rounded-lg shrink-0 border',
                              theme === 'dark'
                                ? 'bg-emerald-500/15 border-emerald-400/35 text-emerald-200'
                                : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-700',
                            ].join(' ')}
                          >
                            Gəldi
                          </span>
                        )}
                        {status === 'absent' && (
                          <span
                            className={[
                              'text-[10px] font-bold px-2 py-0.5 rounded-lg shrink-0 border',
                              theme === 'dark'
                                ? 'bg-red-500/10 border-red-400/30 text-red-200'
                                : 'bg-rose-500/10 border-rose-500/25 text-rose-700',
                            ].join(' ')}
                          >
                            Gəlmədi
                          </span>
                        )}
                        {isFuture && (
                          <span
                            className={[
                              'text-[10px] font-bold px-2 py-0.5 rounded-lg shrink-0 border',
                              theme === 'dark'
                                ? 'bg-gray-500/10 border-white/10 text-gray-300'
                                : 'bg-slate-500/10 border-slate-500/20 text-slate-700',
                            ].join(' ')}
                          >
                            Növbəti
                          </span>
                        )}
                      </div>
                      <div
                        className={[
                          'text-xs font-mono tabular-nums mt-1 truncate',
                          theme === 'dark' ? 'text-gray-500' : 'text-token-textMuted',
                        ].join(' ')}
                      >
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
          ) : false ? (
            <div
              className={[
                'rounded-xl border p-4 space-y-4',
                theme === 'dark'
                  ? 'border-indigo-500/20 bg-[#0f0c29]/60'
                  : 'border-[color:var(--border-subtle)] bg-token-surfaceMain/70',
              ].join(' ')}
            >
              <p className={['text-xs leading-relaxed', theme === 'dark' ? 'text-gray-300' : 'text-token-textMuted'].join(' ')}>
                <span className={['font-semibold', theme === 'dark' ? 'text-indigo-200' : 'text-token-textMain'].join(' ')}>
                  Paket:
                </span>{' '}
                davamiyyət yalnız izləmə və
                hesabat üçündür; <strong>ödəniş borcu</strong> yalnız Ödənişlər bölməsində təqvim ankoruna görə
                hesablanır (dərs sayından asılı deyil). Gələcək tarixlər üçün düymələr deaktivdir.
              </p>
              {monthlyMeta.next && (
                <div
                  className={[
                    'rounded-lg border px-3 py-2 text-xs',
                    theme === 'dark'
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                      : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-800',
                  ].join(' ')}
                >
                  <span className="font-semibold">Növbəti dərs:</span>{' '}
                  <span className="font-mono">{fmtDdMmFromYmd(monthlyMeta.next)}</span>
                  {monthlyMeta.next_status && monthlyMeta.next_status !== 'pending' && (
                    <span className={theme === 'dark' ? 'text-emerald-200/80' : 'text-emerald-700'}>
                      {' '}
                      ({monthlyMeta.next_status})
                    </span>
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
                      <label className={smallLabelCls}>Hesab intervalının sonu (Bakı tarixi)</label>
                      <input
                        type="date"
                        className={smallInputCls}
                        value={monthlyRangeEnd}
                        min={monthlyLessonStats.anchor}
                        max={ymdTodayBaku()}
                        onChange={(e) => setMonthlyRangeEnd(e.target.value)}
                      />
                    </div>
                  </div>
                  <p className={['text-xs', theme === 'dark' ? 'text-gray-400' : 'text-token-textMuted'].join(' ')}>
                    Ödəniş başlanğıcı:{' '}
                    <span className={['font-mono', theme === 'dark' ? 'text-white' : 'text-token-textMain'].join(' ')}>
                      {monthlyLessonStats.anchor}
                    </span>
                    {' → '}
                    <span className={['font-mono', theme === 'dark' ? 'text-white' : 'text-token-textMain'].join(' ')}>
                      {monthlyLessonStats.end}
                    </span>
                    {' · '}
                    <span className="text-emerald-300 font-semibold">{monthlyLessonStats.count}</span> dərs günü
                    (seçilmiş həftəlik cədvələ uyğun)
                  </p>
                </>
              )}
              <div
                className={[
                  'rounded-lg border p-3 space-y-3',
                  theme === 'dark'
                    ? 'border-indigo-500/15 bg-[#13112e]/40'
                    : 'border-[color:var(--border-subtle)] bg-token-surfaceMain/50',
                ].join(' ')}
              >
                <p className={['text-[11px] font-semibold uppercase tracking-wider', theme === 'dark' ? 'text-gray-400' : 'text-token-textMain'].join(' ')}>
                  Toplu əməliyyat aralığı
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={['block text-[10px] mb-1', theme === 'dark' ? 'text-gray-500' : 'text-token-textMuted'].join(' ')}>
                      Başlanğıc
                    </label>
                    <input
                      type="date"
                      className={smallInputCls}
                      value={monthlyActFrom}
                      min={monthlyLessonStats?.anchor}
                      max={monthlyActTo || undefined}
                      onChange={(e) => setMonthlyActFrom(e.target.value)}
                      disabled={monthlyFetching}
                    />
                  </div>
                  <div>
                    <label className={['block text-[10px] mb-1', theme === 'dark' ? 'text-gray-500' : 'text-token-textMuted'].join(' ')}>
                      Son
                    </label>
                    <input
                      type="date"
                      className={smallInputCls}
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
              <div
                className={[
                  'overflow-x-auto rounded-lg border',
                  theme === 'dark' ? 'border-indigo-500/15' : 'border-[color:var(--border-subtle)]',
                ].join(' ')}
              >
                <table className="min-w-full text-xs">
                  <thead
                    className={[
                      theme === 'dark' ? 'bg-[#13112e]/80 text-gray-400' : 'bg-token-surfaceMain text-token-textMuted',
                    ].join(' ')}
                  >
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold">Tarix</th>
                      <th className="text-left px-3 py-2 font-semibold">Status</th>
                      <th className="text-right px-3 py-2 font-semibold">Əməliyyat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyRows.length === 0 && !monthlyFetching && (
                      <tr>
                        <td
                          colSpan={3}
                          className={['px-3 py-4 text-center', theme === 'dark' ? 'text-gray-500' : 'text-token-textMuted'].join(' ')}
                        >
                          Slot yoxdur. &quot;Slotları yenilə&quot; düyməsini sıxın.
                        </td>
                      </tr>
                    )}
                    {monthlyRows.map((row) => {
                      const clipToday = monthlyMeta.today || ymdTodayBaku()
                      const isFutureRow = row.lesson_date > clipToday
                      const rowActionsDisabled = monthlyFetching || isFutureRow
                      return (
                      <tr
                        key={row.lesson_date}
                        className={[
                          'border-t',
                          theme === 'dark' ? 'border-indigo-500/10' : 'border-[color:var(--border-subtle)]',
                        ].join(' ')}
                      >
                        <td
                          className={[
                            'px-3 py-2 font-mono whitespace-nowrap',
                            theme === 'dark' ? 'text-white' : 'text-token-textMain',
                          ].join(' ')}
                        >
                          {fmtDdMmFromYmd(row.lesson_date)}
                          {isFutureRow && (
                            <span
                              className={[
                                'block text-[10px] font-sans normal-case mt-0.5',
                                theme === 'dark' ? 'text-gray-500' : 'text-token-textMuted',
                              ].join(' ')}
                            >
                              gələcək
                            </span>
                          )}
                        </td>
                        <td className={['px-3 py-2 capitalize', theme === 'dark' ? 'text-gray-300' : 'text-token-textMuted'].join(' ')}>
                          {row.status || 'pending'}
                        </td>
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
          <p className={['text-xs leading-relaxed', theme === 'dark' ? 'text-gray-400' : 'text-token-textMuted'].join(' ')}>
            Seçilmiş tarix aralığında cədvəldə olan hər dərs üçün (cari dövr) davamiyyət &quot;Gəldi&quot; kimi yazılır.
            Yalnız bu dövrə aid planlaşdırılmış tarixlər nəzərə alınır.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Başlanğıc</label>
              <input
                type="date"
                className={inputCls}
                value={bulkFrom}
                onChange={(e) => setBulkFrom(e.target.value)}
                disabled={bulkSaving}
              />
            </div>
            <div>
              <label className={labelCls}>Son</label>
              <input
                type="date"
                className={inputCls}
                value={bulkTo}
                onChange={(e) => setBulkTo(e.target.value)}
                disabled={bulkSaving}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Qeyd (istəyə bağlı)</label>
            <input
              className={inputCls}
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
