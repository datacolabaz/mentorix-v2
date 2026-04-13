import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'
import {
  fmtTime,
  parseLessonInstant,
  bakuPartsFromInstant,
  slotTimesForLesson,
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

export default function StudentSchedule() {
  const [loading, setLoading] = useState(true)
  const [lessons, setLessons] = useState([])
  const [prepSlots, setPrepSlots] = useState([])
  const [err, setErr] = useState(null)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  // Default: heç bir gün seçilməsin (qarışdırmasın)
  const [newSlotDays, setNewSlotDays] = useState([])
  const [newStart, setNewStart] = useState('18:00')
  const [newEnd, setNewEnd] = useState('19:00')

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const d = await api.get('/students/my/schedule')
      setLessons(Array.isArray(d.lessons) ? d.lessons : [])
      setPrepSlots(Array.isArray(d.prepSlots) ? d.prepSlots : [])
    } catch (e) {
      setErr(e?.message || 'Yüklənmədi')
      setLessons([])
      setPrepSlots([])
    } finally {
      setLoading(false)
    }
  }, [])

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

    for (const d of m.keys()) {
      m.get(d).sort((a, b) => parseToMinutes(a.start_time) - parseToMinutes(b.start_time))
    }
    return m
  }, [lessons, prepSlots])

  const freeDays = useMemo(() => {
    const l = new Set(lessonDays)
    return WEEKDAYS.map((d) => d.v).filter((x) => !l.has(x))
  }, [lessonDays])

  const toggleNewDay = (v) => {
    setNewSlotDays((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v].sort((a, b) => a - b)))
  }

  const addSlots = async () => {
    const days = newSlotDays.filter((d) => freeDays.includes(d))
    if (!days.length) {
      toast('Boş günlərdən ən azı birini seçin', 'error')
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
      toast(e?.message || 'Xəta', 'error')
    } finally {
      setSaving(false)
    }
  }

  const delSlot = async (id) => {
    if (!window.confirm('Bu slot silinsin?')) return
    try {
      await api.delete('/students/my/prep-slots/' + encodeURIComponent(id))
      toast('Silindi', 'success')
      await load()
    } catch (e) {
      toast(e?.message || 'Xəta', 'error')
    }
  }

  return (
    <div className="p-4 sm:p-6 w-full min-w-0 max-w-4xl mx-auto">
      <div className="flex items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="font-display font-bold text-xl sm:text-2xl text-white">Cədvəlim</h1>
          <p className="text-gray-500 text-sm mt-1">Dərs günləri və hazırlıq üçün boş günlər.</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <p className="text-sm font-semibold mb-1">Hazırlıq üçün slot yarat</p>
          <p className="text-xs text-gray-500 mb-3">
            Boş günləri seçin və saat aralığı verin (məs. 1–4-cü günlər 18:00–19:00).
          </p>

          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((d) => {
              const isFree = freeDays.includes(d.v)
              const selected = newSlotDays.includes(d.v)
              return (
                <button
                  type="button"
                  key={d.v}
                  disabled={!isFree}
                  onClick={() => toggleNewDay(d.v)}
                  className={[
                    'px-3 py-2 rounded-xl text-xs font-semibold border transition-colors',
                    isFree
                      ? selected
                        ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
                        : 'bg-[#13112e] border-indigo-500/20 text-gray-200 hover:border-indigo-400/40'
                      : 'bg-[#13112e] border-indigo-500/10 text-gray-600 opacity-60 cursor-not-allowed',
                  ].join(' ')}
                  title={!isFree ? 'Bu gün dərsiniz var' : 'Hazırlıq günü kimi seç'}
                >
                  {d.full}
                </button>
              )
            })}
          </div>

          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Başla</label>
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

        <Card className="p-5">
          <p className="text-sm font-semibold mb-1">Həftəlik cədvəl</p>
          <div className="flex flex-wrap gap-4 text-xs text-gray-500 mt-2 mb-3">
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-indigo-600/35 border border-indigo-400/45" /> Məşğul
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-[#0f0c29] border border-indigo-500/15" /> Boş
            </span>
          </div>

          <div className="overflow-x-auto">
            <div
              className="grid gap-px bg-indigo-500/20 rounded-xl overflow-hidden border border-indigo-500/25 min-w-[680px]"
              style={{
                gridTemplateColumns: `3.5rem repeat(7, minmax(0,1fr))`,
                gridTemplateRows: `auto repeat(${GRID_ROW_COUNT}, minmax(2rem, 2.25rem))`,
              }}
            >
              <div className="bg-[#13112e] p-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider" />
              {WEEKDAYS.map((d) => (
                <div
                  key={d.v}
                  className="bg-[#13112e] p-2 text-center text-[11px] font-bold text-indigo-200/90 border-l border-indigo-500/15"
                >
                  {d.short}
                </div>
              ))}

              {Array.from({ length: GRID_ROW_COUNT }, (_, i) => GRID_START + i).map((hour) => (
                <Fragment key={hour}>
                  <div className="bg-[#0f0c29] text-[10px] text-gray-500 font-mono tabular-nums flex items-center justify-end pr-2 border-t border-indigo-500/10">
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
                      ? 'bg-indigo-600/25 border-indigo-400/45 text-indigo-100'
                      : ''

                    return (
                      <div
                        key={`${d.v}-${hour}`}
                        className="bg-[#0f0c29]/95 border-l border-t border-indigo-500/10 relative min-h-[2.25rem]"
                      >
                        {isFirstHour && primary && (
                          <div
                            className={`absolute left-0.5 right-0.5 rounded-md border px-1 py-0.5 text-[10px] leading-tight z-10 shadow-sm ${blockStyle}`}
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

      <Card className="p-5 mt-4">
        <p className="text-sm font-semibold mb-3">Hazırlıq slotlarım</p>
        {loading ? (
          <p className="text-sm text-gray-500">Yüklənir…</p>
        ) : prepSlots.length === 0 ? (
          <p className="text-sm text-gray-500">Hələ slot əlavə etməmisiniz.</p>
        ) : (
          <div className="space-y-2">
            {prepSlots.map((s) => (
              <div
                key={s.id}
                className="p-3 rounded-xl bg-[#13112e] border border-indigo-500/20 flex items-center justify-between gap-2"
              >
                <div className="text-sm font-mono text-gray-200">
                  {WEEKDAYS.find((x) => x.v === s.day_of_week)?.short || s.day_of_week} · {fmtTime(s.start_time)}–{fmtTime(s.end_time)}
                </div>
                <button
                  type="button"
                  onClick={() => void delSlot(s.id)}
                  className="text-xs text-red-400 hover:text-red-300 px-2 py-1"
                >
                  Sil
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5 mt-4">
        <p className="text-sm font-semibold mb-3">Dərs cədvəlim (tarixlər)</p>
        {loading ? (
          <p className="text-sm text-gray-500">Yüklənir…</p>
        ) : lessons.length === 0 ? (
          <p className="text-sm text-gray-500">Hələ tarixli dərs qeydi yoxdur.</p>
        ) : (
          <div className="space-y-2">
            {[...lessons]
              .sort((a, b) => String(a.lesson_date).localeCompare(String(b.lesson_date)))
              .map((l) => (
                <div key={l.id} className="p-3 rounded-xl bg-[#13112e] border border-indigo-500/20">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {l.instructor_name ? `Dərs · ${l.instructor_name}` : 'Dərs'}
                      </p>
                      <p className="text-xs text-gray-500">
                        #{l.lesson_number} · Dövr #{l.billing_cycle || 1} · {l.status || '—'}
                      </p>
                    </div>
                    <div className="text-sm font-mono text-gray-200 shrink-0">
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

