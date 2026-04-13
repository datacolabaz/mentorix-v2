import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import ListSkeleton from '../../components/common/ListSkeleton'
import { useToast } from '../../components/common/Toast'

/** 1 = Bazar ertəsi … 7 = Bazar */
export const WEEKDAYS = [
  { v: 1, short: 'B.e.', full: 'Bazar ertəsi' },
  { v: 2, short: 'Ç.a.', full: 'Çərşənbə axşamı' },
  { v: 3, short: 'Çər.', full: 'Çərşənbə' },
  { v: 4, short: 'C.a.', full: 'Cümə axşamı' },
  { v: 5, short: 'Cümə', full: 'Cümə' },
  { v: 6, short: 'Şən.', full: 'Şənbə' },
  { v: 7, short: 'Baz.', full: 'Bazar' },
]

const inp =
  'w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-indigo-400'

function fmtTime(t) {
  if (t == null) return ''
  const s = typeof t === 'string' ? t : String(t)
  return s.slice(0, 5)
}

function parseToMinutes(t) {
  const s = fmtTime(t)
  const [h, m] = s.split(':').map((x) => parseInt(x, 10))
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)
}

function slotCoversHour(slot, hour) {
  const sm = parseToMinutes(slot.start_time)
  const em = parseToMinutes(slot.end_time)
  const rowStart = hour * 60
  const rowEnd = (hour + 1) * 60
  return sm < rowEnd && em > rowStart
}

function slotFirstHour(slot) {
  return Math.floor(parseToMinutes(slot.start_time) / 60)
}

const GRID_START = 8
const GRID_END = 20
const ROW_COUNT = GRID_END - GRID_START

export default function InstructorSchedule() {
  const [loading, setLoading] = useState(true)
  const [slots, setSlots] = useState([])
  const [err, setErr] = useState(null)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const [genDays, setGenDays] = useState([])
  const [genStart, setGenStart] = useState('09:00')
  const [genEnd, setGenEnd] = useState('20:00')
  const [genStep, setGenStep] = useState(60)

  const [oneDay, setOneDay] = useState(1)
  const [oneStart, setOneStart] = useState('10:00')
  const [oneEnd, setOneEnd] = useState('11:00')

  const load = useCallback(async () => {
    setErr(null)
    setLoading(true)
    try {
      const d = await api.get('/teacher-schedules')
      setSlots(d.slots || [])
    } catch (e) {
      setErr(e?.message || 'Yüklənmədi')
      setSlots([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const slotsByDay = useMemo(() => {
    const m = new Map()
    for (let d = 1; d <= 7; d++) m.set(d, [])
    for (const s of slots) {
      const list = m.get(s.day_of_week) || []
      list.push(s)
      m.set(s.day_of_week, list)
    }
    for (const d of m.keys()) {
      m.get(d).sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)))
    }
    return m
  }, [slots])

  const toggleGenDay = (v) => {
    setGenDays((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v].sort((a, b) => a - b)))
  }

  const runGenerate = async () => {
    if (!genDays.length) {
      toast('Ən azı bir gün seçin', 'error')
      return
    }
    setSaving(true)
    try {
      const d = await api.post('/teacher-schedules/generate', {
        days: genDays,
        slot_start: genStart,
        slot_end: genEnd,
        step_minutes: genStep,
      })
      toast(`${d.created || 0} slot əlavə olundu`)
      await load()
    } catch (e) {
      toast(e?.message || 'Xəta', 'error')
    } finally {
      setSaving(false)
    }
  }

  const addOne = async () => {
    setSaving(true)
    try {
      await api.post('/teacher-schedules', {
        day_of_week: oneDay,
        start_time: oneStart,
        end_time: oneEnd,
      })
      toast('Slot əlavə olundu')
      await load()
    } catch (e) {
      toast(e?.message || 'Xəta', 'error')
    } finally {
      setSaving(false)
    }
  }

  const removeSlot = async (id) => {
    if (!window.confirm('Bu slot silinsin?')) return
    try {
      await api.delete('/teacher-schedules/' + encodeURIComponent(id))
      toast('Silindi')
      await load()
    } catch (e) {
      toast(e?.message || 'Xəta', 'error')
    }
  }

  const blockSlot = async (id) => {
    try {
      await api.patch('/teacher-schedules/' + encodeURIComponent(id) + '/block')
      toast('Məşğul (blok) edildi')
      await load()
    } catch (e) {
      toast(e?.message || 'Xəta', 'error')
    }
  }

  const unblockSlot = async (id) => {
    try {
      await api.patch('/teacher-schedules/' + encodeURIComponent(id) + '/unblock')
      toast('Boşaldıldı')
      await load()
    } catch (e) {
      toast(e?.message || 'Xəta', 'error')
    }
  }

  const slotStyle = (s) => {
    if (!s.is_occupied) {
      return 'bg-emerald-500/15 border-emerald-500/35 text-emerald-100'
    }
    // Məşğul = tələbə slotu və ya blok slotu (hər ikisi eyni rəngdə)
    return 'bg-indigo-600/25 border-indigo-400/40 text-indigo-100'
  }

  return (
    <div className="p-4 sm:p-6 min-w-0 max-w-[1200px] mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-4">
        <div>
          <h1 className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight">Cədvəlim</h1>
          <p className="text-gray-500 text-sm mt-1">
            Həftəlik boş və məşğul dərs saatları. Tələbə əlavə edərkən yalnız boş slotlar seçilə bilər.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-indigo-500/25 bg-[#13112e]/80 p-3 sm:p-4 text-xs text-gray-400 space-y-2 mb-6">
        <p className="text-indigo-200/95 font-semibold text-sm">Bu səhifə necə işləyir?</p>
        <ul className="list-disc list-inside space-y-1.5 leading-relaxed">
          <li>
            <strong className="text-gray-300">Slot</strong> — həftənin bir günü üçün konkret dərs vaxtı (məs. B.e.
            10:00–11:00). Slotlar yalnız <strong className="text-gray-300">«Slotlar yarat»</strong> və ya{' '}
            <strong className="text-gray-300">«Slot əlavə et»</strong> düyməsinə basanda verilənlər bazasına yazılır.
          </li>
          <li>
            Yuxarıdakı <strong className="text-gray-300">gün düymələri və saatlar</strong> yalnız yeni slot
            yaratmaq üçündür; onların seçilməsi özü-özlüyündə heç nə saxlamır.
          </li>
          <li>
            Yaranmış slotu ləğv etmək üçün cədvəldə boş slotda <strong className="text-gray-300">Sil</strong> (və ya
            blokdan <strong className="text-gray-300">Boşalt</strong>) istifadə edin.
          </li>
        </ul>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card className="p-4 border border-indigo-500/20">
          <h2 className="text-sm font-bold text-white mb-3 tracking-wide">Şablon: iş saatları</h2>
          <p className="text-xs text-gray-500 mb-3">
            Günləri seçin, saat aralığını və addımı qeyd edin, sonra <strong className="text-gray-400">Slotlar yarat</strong>{' '}
            ilə bir dəfəyə çoxlu slot əlavə edin (məs: 09:00–20:00, 60 dəq).
          </p>
          <div className="flex flex-wrap gap-2 mb-3">
            {WEEKDAYS.map((d) => (
              <button
                key={d.v}
                type="button"
                onClick={() => toggleGenDay(d.v)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                  genDays.includes(d.v)
                    ? 'bg-indigo-600/40 border-indigo-400/50 text-white'
                    : 'bg-[#0f0c29] border-indigo-500/15 text-gray-500'
                }`}
              >
                {d.short}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div>
              <label className="text-[10px] uppercase text-gray-500 font-semibold">Başlanğıc</label>
              <input className={inp} type="time" value={genStart} onChange={(e) => setGenStart(e.target.value)} />
            </div>
            <div>
              <label className="text-[10px] uppercase text-gray-500 font-semibold">Son</label>
              <input className={inp} type="time" value={genEnd} onChange={(e) => setGenEnd(e.target.value)} />
            </div>
            <div>
              <label className="text-[10px] uppercase text-gray-500 font-semibold">Addım (dəq)</label>
              <select className={inp} value={genStep} onChange={(e) => setGenStep(Number(e.target.value))}>
                {[30, 45, 60, 90, 120].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Button type="button" onClick={() => void runGenerate()} loading={saving} className="w-full justify-center">
            Slotlar yarat
          </Button>
        </Card>

        <Card className="p-4 border border-indigo-500/20">
          <h2 className="text-sm font-bold text-white mb-3 tracking-wide">Tək slot</h2>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="col-span-3 sm:col-span-1">
              <label className="text-[10px] uppercase text-gray-500 font-semibold">Gün</label>
              <select className={inp} value={oneDay} onChange={(e) => setOneDay(Number(e.target.value))}>
                {WEEKDAYS.map((d) => (
                  <option key={d.v} value={d.v}>
                    {d.full}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase text-gray-500 font-semibold">Başlanğıc</label>
              <input className={inp} type="time" value={oneStart} onChange={(e) => setOneStart(e.target.value)} />
            </div>
            <div>
              <label className="text-[10px] uppercase text-gray-500 font-semibold">Son</label>
              <input className={inp} type="time" value={oneEnd} onChange={(e) => setOneEnd(e.target.value)} />
            </div>
          </div>
          <Button type="button" variant="secondary" onClick={() => void addOne()} loading={saving} className="w-full justify-center">
            Slot əlavə et
          </Button>
        </Card>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-gray-500 mb-3">
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-emerald-500/30 border border-emerald-500/40" /> Boş
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-indigo-600/40 border border-indigo-400/50" /> Məşğul
        </span>
      </div>

      <Card className="overflow-x-auto border border-indigo-500/20">
        {loading && (
          <div className="p-8">
            <ListSkeleton message="Cədvəl yüklənir…" />
          </div>
        )}
        {!loading && err && (
          <div className="p-6 text-center text-amber-200/90 text-sm">
            {err}
            <div className="mt-3">
              <Button type="button" size="sm" onClick={() => void load()}>
                Yenidən
              </Button>
            </div>
          </div>
        )}
        {!loading && !err && (
          <div className="p-2 sm:p-4 min-w-[720px]">
            <div
              className="grid gap-px bg-indigo-500/20 rounded-xl overflow-hidden border border-indigo-500/25"
              style={{
                gridTemplateColumns: `3.5rem repeat(7, minmax(0,1fr))`,
                gridTemplateRows: `auto repeat(${ROW_COUNT}, minmax(2rem, 2.25rem))`,
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
              {Array.from({ length: ROW_COUNT }, (_, i) => GRID_START + i).map((hour) => (
                <Fragment key={hour}>
                  <div className="bg-[#0f0c29] text-[10px] text-gray-500 font-mono tabular-nums flex items-center justify-end pr-2 border-t border-indigo-500/10">
                    {String(hour).padStart(2, '0')}:00
                  </div>
                  {WEEKDAYS.map((d) => {
                    const dayList = slotsByDay.get(d.v) || []
                    const hourSlots = dayList.filter((s) => slotCoversHour(s, hour))
                    const primary = hourSlots.sort(
                      (a, b) => parseToMinutes(a.start_time) - parseToMinutes(b.start_time)
                    )[0]
                    const isFirstHour = primary && slotFirstHour(primary) === hour
                    const spanHours = primary
                      ? Math.max(1, Math.ceil(parseToMinutes(primary.end_time) / 60) - slotFirstHour(primary))
                      : 1
                    return (
                      <div
                        key={`${d.v}-${hour}`}
                        className="bg-[#0f0c29]/95 border-l border-t border-indigo-500/10 relative min-h-[2.25rem]"
                      >
                        {isFirstHour && primary && (
                          <div
                            className={`absolute left-0.5 right-0.5 rounded-md border px-1 py-0.5 text-[10px] leading-tight z-10 shadow-sm ${slotStyle(primary)}`}
                            style={{
                              top: '2px',
                              minHeight: `${spanHours * 2.25 - 0.35}rem`,
                            }}
                          >
                            <div className="font-semibold truncate">
                              {fmtTime(primary.start_time)}–{fmtTime(primary.end_time)}
                            </div>
                            {!primary.is_occupied && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                <button
                                  type="button"
                                  className="text-[9px] underline text-emerald-300"
                                  onClick={() => void blockSlot(primary.id)}
                                >
                                  Blok
                                </button>
                                <button
                                  type="button"
                                  className="text-[9px] underline text-red-300"
                                  onClick={() => void removeSlot(primary.id)}
                                >
                                  Sil
                                </button>
                              </div>
                            )}
                            {primary.is_occupied && !primary.enrollment_id && (
                              <button
                                type="button"
                                className="text-[9px] underline text-gray-200 mt-0.5"
                                onClick={() => void unblockSlot(primary.id)}
                              >
                                Boşalt
                              </button>
                            )}
                            {primary.is_occupied && primary.enrollment_id && (
                              <div className="text-[9px] opacity-90 truncate mt-0.5">{primary.student_name || 'Tələbə'}</div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </Fragment>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
