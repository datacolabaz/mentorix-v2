import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import { useToast } from '../../components/common/Toast'
import GroupSwitcher from '../../components/student/GroupSwitcher'
import { useStudentGroups } from '../../contexts/StudentGroupContext'
import { withEnrollmentQuery } from '../../lib/studentGroupQuery'
import {
  fmtTime,
  parseLessonInstant,
  bakuPartsFromInstant,
  slotTimesForLesson,
  weeklySlotFromPattern,
  fmtAzBakuLessonRow,
  parseToMinutes,
  slotCoversHour,
  slotFirstHour,
  GRID_START,
  GRID_END,
  GRID_ROW_COUNT,
} from '../../lib/lessonWeekGrid'

const WEEKDAYS = [
  { v: 1, short: 'B.e.', full: 'Bazar ertəsi' },
  { v: 2, short: 'Ç.a.', full: 'Çərşənbə axşamı' },
  { v: 3, short: 'Çər.', full: 'Çərşənbə' },
  { v: 4, short: 'C.a.', full: 'Cümə axşamı' },
  { v: 5, short: 'Cümə', full: 'Cümə' },
  { v: 6, short: 'Şən.', full: 'Şənbə' },
  { v: 7, short: 'Baz.', full: 'Bazar' },
]

function normalizeWeekdays(raw) {
  let arr = raw
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw)
    } catch {
      arr = []
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

function parseLessonTimesMap(raw) {
  let obj = raw
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw)
    } catch {
      obj = {}
    }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {}
  return obj
}

export default function StudentSchedule() {
  const { activeEnrollmentId, activeEnrollment } = useStudentGroups()
  const [loading, setLoading] = useState(true)
  const [lessons, setLessons] = useState([])
  const [prepSlots, setPrepSlots] = useState([])
  const [weeklyPattern, setWeeklyPattern] = useState(null) // { lesson_weekdays, lesson_times, lesson_end_times }
  const [err, setErr] = useState(null)
  const [saving, setSaving] = useState(false)
  const [conflictOpen, setConflictOpen] = useState(false)
  const [conflictMsg, setConflictMsg] = useState('')
  const [deleteSlotId, setDeleteSlotId] = useState(null)
  const toast = useToast()

  // Default: heç bir gün seçilməsin (qarışdırmasın)
  const [newSlotDays, setNewSlotDays] = useState([])
  const [newStart, setNewStart] = useState('18:00')
  const [newEnd, setNewEnd] = useState('19:00')

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const d = await api.get(withEnrollmentQuery('/students/my/schedule', activeEnrollmentId))
      setLessons(Array.isArray(d.lessons) ? d.lessons : [])
      setPrepSlots(Array.isArray(d.prepSlots) ? d.prepSlots : [])

      const fromApi = d?.weeklyPattern
      const fromCtx =
        activeEnrollment?.lesson_weekdays || activeEnrollment?.lesson_times
          ? {
              lesson_weekdays: activeEnrollment.lesson_weekdays,
              lesson_times: activeEnrollment.lesson_times,
              lesson_end_times: activeEnrollment.lesson_end_times,
            }
          : null
      const pattern = fromApi || fromCtx
      if (pattern && normalizeWeekdays(pattern.lesson_weekdays).length) {
        setWeeklyPattern(pattern)
      } else {
        setWeeklyPattern(null)
      }
    } catch (e) {
      setErr(e?.message || 'Yüklənmədi')
      setLessons([])
      setPrepSlots([])
      setWeeklyPattern(null)
    } finally {
      setLoading(false)
    }
  }, [
    activeEnrollmentId,
    activeEnrollment?.lesson_weekdays,
    activeEnrollment?.lesson_times,
    activeEnrollment?.lesson_end_times,
  ])

  useEffect(() => {
    void load()
  }, [load])

  const lessonDays = useMemo(() => {
    const set = new Set()
    for (const l of lessons) {
      if (!l?.lesson_date) continue
      const inst = parseLessonInstant(l.lesson_date)
      if (!inst) continue
      const { dow } = bakuPartsFromInstant(inst)
      if (dow) set.add(dow)
    }
    return [...set].sort((a, b) => a - b)
  }, [lessons])

  const patternDays = useMemo(() => {
    if (!weeklyPattern) return []
    const wd = normalizeWeekdays(weeklyPattern.lesson_weekdays)
    const lt = parseLessonTimesMap(weeklyPattern.lesson_times)
    return wd.filter((d) => {
      const t = lt?.[String(d)] ?? lt?.[d]
      return !!t
    })
  }, [weeklyPattern])

  const scheduleSlotsByDay = useMemo(() => {
    const m = new Map()
    for (let d = 1; d <= 7; d++) m.set(d, [])

    // Dərs slotları (dated lessons). End_time: default 60 dəq.
    for (const l of lessons) {
      const slot = slotTimesForLesson(l)
      if (!slot) continue
      const { day, start, end } = slot
      const list = m.get(day) || []
      list.push({
        id: `lesson-${l.id}`,
        kind: 'lesson',
        day_of_week: day,
        start_time: start,
        end_time: end,
        title: l.instructor_name ? `Dərs · ${l.instructor_name}` : 'Dərs',
      })
      m.set(day, list)
    }

    // Hazırlıq slotları (tələbənin özü)
    for (const s of prepSlots) {
      const day = Number(s.day_of_week)
      if (!Number.isFinite(day)) continue
      const list = m.get(day) || []
      list.push({
        id: `prep-${s.id}`,
        kind: 'prep',
        day_of_week: day,
        start_time: s.start_time,
        end_time: s.end_time,
        title: 'Hazırlıq',
      })
      m.set(day, list)
    }

    // Müəllimin təyin etdiyi həftəlik paket saatları (tarixsiz) — real `lessons` yoxdursa belə görünsün.
    if (weeklyPattern) {
      const wd = normalizeWeekdays(weeklyPattern.lesson_weekdays)
      const lt = parseLessonTimesMap(weeklyPattern.lesson_times)
      const let_ = parseLessonTimesMap(weeklyPattern.lesson_end_times)
      for (const day of wd) {
        const slot = weeklySlotFromPattern(day, lt, let_)
        if (!slot) continue
        const list = m.get(day) || []
        const hasLesson = list.some((x) => x.kind === 'lesson')
        if (hasLesson) continue
        list.push({
          id: `weekly-${day}`,
          kind: 'weekly',
          day_of_week: day,
          start_time: slot.start,
          end_time: slot.end,
          title: 'Paket (həftəlik)',
        })
        m.set(day, list)
      }
    }

    for (const d of m.keys()) {
      m.get(d).sort((a, b) => parseToMinutes(a.start_time) - parseToMinutes(b.start_time))
    }
    return m
  }, [lessons, prepSlots, weeklyPattern])

  const gridEnd = useMemo(() => {
    let maxEnd = GRID_END
    for (const list of scheduleSlotsByDay.values()) {
      for (const s of list) {
        const em = parseToMinutes(s.end_time)
        const endHour = Math.ceil(em / 60)
        if (Number.isFinite(endHour)) maxEnd = Math.max(maxEnd, endHour)
      }
    }
    return Math.max(GRID_START + 1, Math.min(24, maxEnd))
  }, [scheduleSlotsByDay])

  const gridRowCount = Math.max(1, gridEnd - GRID_START)

  const toggleNewDay = (v) => {
    setNewSlotDays((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v].sort((a, b) => a - b)))
  }

  const addSlots = async () => {
    const days = newSlotDays
    if (!days.length) {
      toast('Ən azı bir gün seçin', 'error')
      return
    }
    setSaving(true)
    try {
      await api.post('/students/my/prep-slots', {
        days,
        start_time: newStart,
        end_time: newEnd,
      })
      toast('Hazırlıq slotları əlavə olundu', 'success')
      await load()
    } catch (e) {
      const msg = e?.message || 'Xəta'
      const status = e?.status
      if (status === 409 || /toqquşma/i.test(msg)) {
        setConflictMsg(msg)
        setConflictOpen(true)
      } else {
        toast(msg, 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  const delSlot = async () => {
    if (!deleteSlotId) return
    const id = deleteSlotId
    try {
      await api.delete('/students/my/prep-slots/' + encodeURIComponent(id))
      toast('Silindi', 'success')
      setDeleteSlotId(null)
      await load()
    } catch (e) {
      toast(e?.message || 'Xəta', 'error')
    }
  }

  return (
    <div className="p-4 sm:p-6 w-full min-w-0 max-w-4xl mx-auto">
      <ConfirmDialog
        open={Boolean(deleteSlotId)}
        onClose={() => setDeleteSlotId(null)}
        onConfirm={() => void delSlot()}
        title="Slotu sil"
        message="Bu hazırlıq slotu silinsin?"
        confirmLabel="Sil"
        cancelLabel="Ləğv et"
        danger
      />
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 flex-1 min-w-0">
          <div className="min-w-0">
            <h1 className="font-display font-bold text-xl sm:text-2xl text-token-textMain">Cədvəlim</h1>
            {activeEnrollment && (
              <p className="text-sm text-token-textMuted mt-1">
                {activeEnrollment.group_name} • {activeEnrollment.instructor_name}
              </p>
            )}
            <p className="text-token-textMuted text-sm mt-1">Seçilmiş qrupun dərsləri və hazırlıq slotları.</p>
          </div>
          <GroupSwitcher className="w-full sm:w-auto sm:min-w-[200px] shrink-0" />
        </div>
        <Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
          Yenilə
        </Button>
      </div>

      {err && (
        <Card className="p-4 border border-red-500/30 bg-red-500/10 text-red-200 mb-4">
          {err}
        </Card>
      )}

      <Modal open={conflictOpen} onClose={() => setConflictOpen(false)} title="Slot yaradılmadı" size="md">
        <div className="space-y-4">
          <p className="text-sm text-token-textMain leading-relaxed">{conflictMsg}</p>
          <div className="flex justify-end">
            <Button type="button" onClick={() => setConflictOpen(false)} className="justify-center">
              Bağla
            </Button>
          </div>
        </div>
      </Modal>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card hover className="p-5">
          <p className="text-sm font-semibold mb-1">Hazırlıq üçün slot yarat</p>
          <p className="text-xs text-token-textMuted mb-3">
            Günləri seçin və saat aralığı verin. Dərs saatı ilə toqquşarsa sistem icazə verməyəcək.
          </p>

          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((d) => {
              const selected = newSlotDays.includes(d.v)
              return (
                <button
                  type="button"
                  key={d.v}
                  onClick={() => toggleNewDay(d.v)}
                  className={[
                    'px-3 py-2 rounded-xl text-xs font-semibold border transition-colors',
                    selected
                      ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
                      : 'bg-[#13112e] border-indigo-500/20 text-gray-200 hover:border-indigo-400/40',
                  ].join(' ')}
                  title="Hazırlıq günü kimi seç"
                >
                  {d.full}
                </button>
              )
            })}
          </div>

          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <label className="block text-xs text-token-textMuted mb-1">Başla</label>
              <input
                type="time"
                value={newStart}
                onChange={(e) => setNewStart(e.target.value)}
                className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-indigo-400"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Bitir</label>
              <input
                type="time"
                value={newEnd}
                onChange={(e) => setNewEnd(e.target.value)}
                className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-indigo-400"
              />
            </div>
          </div>

          <div className="mt-3">
            <Button onClick={() => void addSlots()} loading={saving} className="w-full justify-center">
              Slot əlavə et
            </Button>
          </div>
        </Card>

        <Card hover className="p-5">
          <p className="text-sm font-semibold mb-1">Həftəlik cədvəl</p>
          <div className="flex flex-wrap gap-4 text-xs text-token-textMuted mt-2 mb-3">
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-primary/20 border border-primary/30" /> Məşğul
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-token-surfaceCard/50 border border-[color:var(--border-subtle)]" /> Boş
            </span>
          </div>

          <div className="overflow-x-auto">
            <div
              className="grid gap-px bg-[color:var(--border-subtle)] rounded-xl overflow-hidden border border-[color:var(--border-subtle)] min-w-[680px] max-h-[70vh] overflow-y-auto"
              style={{
                gridTemplateColumns: `3.5rem repeat(7, minmax(0,1fr))`,
                gridTemplateRows: `auto repeat(${gridRowCount}, minmax(2rem, 2.25rem))`,
              }}
            >
              <div className="bg-token-surfaceCard/55 p-2 text-[10px] font-semibold text-token-textMuted uppercase tracking-wider" />
              {WEEKDAYS.map((d) => (
                <div
                  key={d.v}
                  className="bg-token-surfaceCard/55 p-2 text-center text-[11px] font-bold text-token-textMain border-l border-[color:var(--border-subtle)]"
                >
                  {d.short}
                </div>
              ))}

              {Array.from({ length: gridRowCount }, (_, i) => GRID_START + i).map((hour) => (
                <Fragment key={hour}>
                  <div className="bg-token-surfaceCard/40 text-[10px] text-token-textMuted font-mono tabular-nums flex items-center justify-end pr-2 border-t border-[color:var(--border-subtle)]">
                    {String(hour).padStart(2, '0')}:00
                  </div>
                  {WEEKDAYS.map((d) => {
                    const dayList = scheduleSlotsByDay.get(d.v) || []
                    const hourSlots = dayList.filter((s) => slotCoversHour(s, hour))
                    const primary = hourSlots.sort(
                      (a, b) => parseToMinutes(a.start_time) - parseToMinutes(b.start_time)
                    )[0]
                    const isFirstHour = primary && slotFirstHour(primary) === hour
                    const spanHours = primary
                      ? Math.max(1, Math.ceil(parseToMinutes(primary.end_time) / 60) - slotFirstHour(primary))
                      : 1

                    const blockStyle = primary
                      ? 'bg-token-surfaceCard/55 border-[color:var(--border-subtle)] text-token-textMain hover:bg-token-surfaceCardHover/80 hover:border-primary/25 transition-colors'
                      : ''

                    return (
                      <div
                        key={`${d.v}-${hour}`}
                        className="bg-token-surfaceMain/30 border-l border-t border-[color:var(--border-subtle)] relative min-h-[2.25rem]"
                      >
                        {isFirstHour && primary && (
                          <div
                            className={`absolute left-0.5 right-0.5 rounded-md border px-1 py-0.5 text-[10px] leading-tight z-10 shadow-sm cursor-default ${blockStyle}`}
                            style={{
                              top: '2px',
                              minHeight: `${spanHours * 2.25 - 0.35}rem`,
                            }}
                            title={primary.title}
                          >
                            <div className="font-semibold truncate">
                              {fmtTime(primary.start_time)}–{fmtTime(primary.end_time)}
                            </div>
                            <div className="text-[9px] opacity-95 truncate mt-0.5">{primary.title}</div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </Fragment>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <Card hover className="p-5 mt-4">
        <p className="text-sm font-semibold mb-3">Hazırlıq slotlarım</p>
        {loading ? (
          <p className="text-sm text-token-textMuted">Yüklənir…</p>
        ) : prepSlots.length === 0 ? (
          <p className="text-sm text-token-textMuted">Hələ slot əlavə etməmisiniz.</p>
        ) : (
          <div className="space-y-2">
            {prepSlots.map((s) => (
              <div
                key={s.id}
                className="p-3 rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceCard/40 hover:bg-token-surfaceCard/55 transition-colors flex items-center justify-between gap-2"
              >
                <div className="text-sm font-mono text-token-textMain">
                  {WEEKDAYS.find((x) => x.v === s.day_of_week)?.short || s.day_of_week} · {fmtTime(s.start_time)}–{fmtTime(s.end_time)}
                </div>
                <button
                  type="button"
                  onClick={() => setDeleteSlotId(s.id)}
                  className="text-xs text-red-400 hover:text-red-300 px-2 py-1"
                >
                  Sil
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card hover className="p-5 mt-4">
        <p className="text-sm font-semibold mb-3">Dərs cədvəlim (tarixlər)</p>
        {loading ? (
          <p className="text-sm text-token-textMuted">Yüklənir…</p>
        ) : lessons.length === 0 ? (
          <p className="text-sm text-token-textMuted">Hələ tarixli dərs qeydi yoxdur.</p>
        ) : (
          <div className="space-y-2">
            {[...lessons]
              .sort((a, b) => String(a.lesson_date).localeCompare(String(b.lesson_date)))
              .map((l) => (
                <div
                  key={l.id}
                  className="p-3 rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceCard/40 hover:bg-token-surfaceCard/55 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate text-token-textMain">
                        {l.instructor_name ? `Dərs · ${l.instructor_name}` : 'Dərs'}
                      </p>
                      <p className="text-xs text-token-textMuted">
                        #{l.lesson_number} · Dövr #{l.billing_cycle || 1} · {l.status || '—'}
                      </p>
                    </div>
                    <div className="text-sm font-mono text-token-textMain shrink-0">
                      {l.lesson_date ? fmtAzBakuLessonRow(l) : '—'}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </Card>
    </div>
  )
}

