import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import ListSkeleton from '../../components/common/ListSkeleton'
import Modal from '../../components/common/Modal'
import {
  fmtTime,
  slotTimesForLesson,
  fmtAzBakuLessonRow,
  parseToMinutes,
  slotCoversHour,
  slotFirstHour,
  GRID_START,
  GRID_END,
  GRID_ROW_COUNT,
} from '../../lib/lessonWeekGrid'
import { readCache, writeCache } from '../../lib/cache'

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

/**
 * @typedef {{ day_of_week: number, start_time: string, end_time: string }} SlotFilter
 * @typedef {{ phase: 'pickStudent', slotSubtitle: string, studentNames: string[], slotFilter: SlotFilter }} PickState
 * @typedef {{ phase: 'lessons', slotSubtitle: string, studentNames: string[], slotFilter: SlotFilter, studentName: string, lessons: object[] }} LessonsState
 */

export default function InstructorSchedule() {
  const [loading, setLoading] = useState(true)
  const [datedLessons, setDatedLessons] = useState([])
  const [err, setErr] = useState(null)

  /** @type {[PickState | LessonsState | null, (v: PickState | LessonsState | null) => void]} */
  const [cellModal, setCellModal] = useState(null)

  const CACHE_KEY = 'instructor_schedule_lessons_v2'
  const CACHE_TTL_MS = 60000

  const load = useCallback(async (quiet = false) => {
    setErr(null)
    if (!quiet) setLoading(true)
    try {
      const dated = await api.get('/students/instructor/my-lessons')
      const next = Array.isArray(dated.lessons) ? dated.lessons : []
      setDatedLessons(next)
      writeCache(CACHE_KEY, { lessons: next })
    } catch (e) {
      if (!quiet) {
        setErr(e?.message || 'Yüklənmədi')
        setDatedLessons([])
      }
    } finally {
      if (!quiet) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const cached = readCache(CACHE_KEY, CACHE_TTL_MS)
    if (cached && Array.isArray(cached.lessons)) {
      setDatedLessons(cached.lessons)
      setLoading(false)
    }
    void load(true)
  }, [load])

  /** Eyni gün + eyni başlanğıc/bitmə: tələbələri bir xanada topla. */
  const datedSlotsByDay = useMemo(() => {
    const m = new Map()
    for (let d = 1; d <= 7; d++) m.set(d, new Map())

    for (const l of datedLessons) {
      const slot = slotTimesForLesson(l)
      if (!slot) continue
      const { day, start, end } = slot
      const name = (l.student_name || '').trim() || 'Tələbə'
      const key = `${start}|${end}`
      const dayMap = m.get(day)
      if (!dayMap.has(key)) {
        dayMap.set(key, {
          id: `lesgrp-${day}-${key}`,
          day_of_week: day,
          start_time: start,
          end_time: end,
          studentNames: [],
        })
      }
      const g = dayMap.get(key)
      if (!g.studentNames.includes(name)) g.studentNames.push(name)
    }

    const out = new Map()
    for (let d = 1; d <= 7; d++) {
      const arr = [...(m.get(d) || new Map()).values()].sort(
        (a, b) => parseToMinutes(a.start_time) - parseToMinutes(b.start_time)
      )
      out.set(d, arr)
    }
    return out
  }, [datedLessons])

  const gridEnd = useMemo(() => {
    let maxEnd = GRID_END
    for (const dayList of datedSlotsByDay.values()) {
      for (const s of dayList) {
        const em = parseToMinutes(s.end_time)
        const endHour = Math.ceil(em / 60)
        if (Number.isFinite(endHour)) maxEnd = Math.max(maxEnd, endHour)
      }
    }
    // always show at least one hour past last label, but keep sane upper bound (0..24)
    return Math.max(GRID_START + 1, Math.min(24, maxEnd))
  }, [datedSlotsByDay])

  const gridRowCount = Math.max(1, gridEnd - GRID_START)

  const openCellModal = (dayFull, primary) => {
    setCellModal({
      phase: 'pickStudent',
      slotSubtitle: `${dayFull} · ${fmtTime(primary.start_time)}–${fmtTime(primary.end_time)}`,
      studentNames: primary.studentNames?.length ? [...primary.studentNames] : ['Tələbə'],
      slotFilter: {
        day_of_week: primary.day_of_week,
        start_time: primary.start_time,
        end_time: primary.end_time,
      },
    })
  }

  const pickStudent = (name, slotSubtitle, studentNames, slotFilter) => {
    const n = (name || '').trim()
    let lessons = datedLessons.filter((l) => (l.student_name || '').trim() === n)
    if (slotFilter?.day_of_week) {
      lessons = lessons.filter((l) => {
        const slot = slotTimesForLesson(l)
        if (!slot) return false
        return (
          slot.day === slotFilter.day_of_week &&
          slot.start === slotFilter.start_time &&
          slot.end === slotFilter.end_time
        )
      })
    }
    lessons.sort((a, b) => String(a.lesson_date).localeCompare(String(b.lesson_date)))
    setCellModal({
      phase: 'lessons',
      slotSubtitle,
      studentNames,
      slotFilter,
      studentName: n,
      lessons,
    })
  }

  return (
    <div className="p-4 sm:p-6 min-w-0 max-w-[1200px] mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-3">
        <div>
          <h1 className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight">Cədvəlim</h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-1 leading-relaxed line-clamp-4 sm:line-clamp-none">
            Bu səhifə <span className="text-gray-300">həftəlik cədvəl xəritəsi</span>dir: hər xana «həftənin bu günü, bu saatda kimdə dərs var»ı göstərir, bütün tarixlər üzrə ardıcıllıq deyil. Paket (8/12) üçün real tarixli
            dərslər, aylıq üçün isə həmin gün+saat üçün <span className="text-gray-300">növbəti yaxın bir təqvim tarixi</span> nümunə kimi əlavə olunur — tələbə sentyabrdan hazırlığa gəlirsə belə, burada «cəmi 1
            tarix» görmək o demək deyil ki, o yalnız bir dəfə gəlib; o, yalnız bu xananı təqvimdə harada «taxlamaq» lazım olduğunu göstərir.
          </p>
        </div>
        <Button type="button" variant="secondary" size="sm" className="w-full sm:w-auto justify-center" onClick={() => void load()} disabled={loading}>
          Yenilə
        </Button>
      </div>

      <Card className="border border-white/10 p-4 sm:p-5">
        {loading ? (
          <div className="py-10">
            <ListSkeleton message="Cədvəl yüklənir…" />
          </div>
        ) : err ? (
          <div className="text-center text-amber-200/90 text-sm py-8">
            {err}
            <div className="mt-3">
              <Button type="button" size="sm" onClick={() => void load()}>
                Yenidən
              </Button>
            </div>
          </div>
        ) : datedLessons.length === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center">Hələ tarixli dərs qeydi yoxdur.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-4 text-xs text-gray-500 mb-3">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-primary/20 border border-primary/30" /> Dərs
              </span>
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-surface-1 border border-white/10" /> Boş
              </span>
            </div>
            <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
              <div
                className="grid gap-px bg-white/10 rounded-xl overflow-hidden border border-white/10 min-w-[680px] max-h-[70vh] overflow-y-auto"
                style={{
                  gridTemplateColumns: `3.5rem repeat(7, minmax(0,1fr))`,
                  gridTemplateRows: `auto repeat(${gridRowCount}, minmax(2rem, 2.25rem))`,
                }}
              >
                <div className="bg-surface-2 p-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider" />
                {WEEKDAYS.map((d) => (
                  <div
                    key={d.v}
                    className="bg-surface-2 p-2 text-center text-[11px] font-bold text-gray-200 border-l border-white/10"
                  >
                    {d.short}
                  </div>
                ))}
                {Array.from({ length: gridRowCount }, (_, i) => GRID_START + i).map((hour) => (
                  <Fragment key={`h-${hour}`}>
                    <div className="bg-surface-1 text-[10px] text-gray-500 font-mono tabular-nums flex items-center justify-end pr-2 border-t border-white/10">
                      {String(hour).padStart(2, '0')}:00
                    </div>
                    {WEEKDAYS.map((d) => {
                      const dayList = datedSlotsByDay.get(d.v) || []
                      const hourSlots = dayList.filter((s) => slotCoversHour(s, hour))
                      const primary = hourSlots.sort(
                        (a, b) => parseToMinutes(a.start_time) - parseToMinutes(b.start_time)
                      )[0]
                      const isFirstHour = primary && slotFirstHour(primary) === hour
                      const spanHours = primary
                        ? Math.max(1, Math.ceil(parseToMinutes(primary.end_time) / 60) - slotFirstHour(primary))
                        : 1
                      const n = primary?.studentNames?.length || 0
                      const countLabel = n <= 1 ? '1 tələbə' : `${n} tələbə`
                      return (
                        <div
                          key={`c-${d.v}-${hour}`}
                          className="bg-[#0f0c29]/95 border-l border-t border-indigo-500/10 relative min-h-[2.25rem]"
                        >
                          {isFirstHour && primary && (
                            <button
                              type="button"
                              className="absolute left-0.5 right-0.5 rounded-md border px-1 py-1 text-[10px] leading-tight z-10 shadow-sm text-left bg-indigo-600/25 border-indigo-400/45 text-indigo-100 cursor-pointer hover:brightness-110 active:scale-[0.99] transition-transform min-h-[2rem]"
                              style={{
                                top: '2px',
                                minHeight: `${spanHours * 2.25 - 0.35}rem`,
                              }}
                              onClick={() => openCellModal(d.full, primary)}
                            >
                              <div className="font-semibold truncate">
                                {fmtTime(primary.start_time)}–{fmtTime(primary.end_time)}
                              </div>
                              <div className="text-[9px] font-semibold tabular-nums mt-0.5 opacity-95">{countLabel}</div>
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </Fragment>
                ))}
              </div>
            </div>
          </>
        )}
      </Card>

      <Modal
        open={Boolean(cellModal)}
        onClose={() => setCellModal(null)}
        title={cellModal?.phase === 'lessons' ? cellModal.studentName : 'Tarixli dərs'}
        size="sm"
      >
        {cellModal?.slotSubtitle ? (
          <p className="text-xs text-gray-400 mb-3 font-mono tabular-nums">{cellModal.slotSubtitle}</p>
        ) : null}

        {cellModal?.phase === 'pickStudent' && (
          <>
            <p className="text-xs text-gray-500 mb-3">
              Tələbəni seçin — aşağıda bu xananın günü və saatına uyğun qeydlər (paket tarixləri və ya aylıq üçün növbəti nümunə tarix) göstərilir.
            </p>
            <ul className="space-y-2">
              {cellModal.studentNames.map((name) => (
                <li key={name}>
                  <button
                    type="button"
                    className="w-full text-left rounded-xl border border-indigo-500/25 bg-[#13112e] px-3 py-2.5 text-sm text-white hover:border-indigo-400/50 hover:bg-[#1a1740] transition-colors"
                    onClick={() =>
                      pickStudent(name, cellModal.slotSubtitle, [...cellModal.studentNames], cellModal.slotFilter)
                    }
                  >
                    {name}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {cellModal?.phase === 'lessons' && (
          <>
            {cellModal.lessons.some((l) => l.status === 'monthly_grid') ? (
              <p className="text-[10px] text-gray-500 leading-relaxed mb-2 rounded-lg border border-indigo-500/20 bg-[#13112e]/80 px-2 py-1.5">
                <span className="text-indigo-200/95 font-semibold">Aylıq cədvəl nümunəsi:</span> aşağıdakı tarix bu gün və saat üçün sistemdə növbəti yaxın uyğun gündür. Davamiyyət tarixçəsi, bütün keçmiş
                dərslər və ya «neçənci dərs» burada göstərilmir — yalnız həftəlik şəbəkədə bu xananı təsdiqləmək üçündür.
              </p>
            ) : (
              <p className="text-[10px] text-gray-500 leading-relaxed mb-2">
                Aşağıda yalnız <span className="text-gray-300">bu xanaya düşən</span> tarixli dərs qeydləri var (paket üzrə planlaşdırılmış tarixlər).
              </p>
            )}
            <div className="flex items-center justify-between gap-2 mb-3">
              <p className="text-xs text-gray-500">
                {cellModal.lessons.some((l) => l.status === 'monthly_grid') ? (
                  <>
                    Bu xana üçün nümunə:{' '}
                    <span className="text-indigo-200 font-semibold">{cellModal.lessons.length}</span> tarix
                  </>
                ) : (
                  <>
                    Cəmi <span className="text-indigo-200 font-semibold">{cellModal.lessons.length}</span> tarix
                  </>
                )}
              </p>
              <button
                type="button"
                className="text-xs font-semibold text-blue-400 hover:text-blue-300"
                onClick={() =>
                  setCellModal({
                    phase: 'pickStudent',
                    slotSubtitle: cellModal.slotSubtitle,
                    studentNames: cellModal.studentNames,
                    slotFilter: cellModal.slotFilter,
                  })
                }
              >
                ← Tələbələr
              </button>
            </div>
            <ul className="space-y-2 max-h-[50vh] overflow-y-auto">
              {cellModal.lessons.map((l) => (
                <li
                  key={l.id}
                  className="rounded-xl border border-indigo-500/15 bg-[#0f0c29]/80 px-3 py-2 text-sm text-gray-200 font-mono"
                >
                  {fmtAzBakuLessonRow(l)}
                </li>
              ))}
            </ul>
          </>
        )}

        <Button type="button" variant="secondary" className="w-full mt-5 justify-center" onClick={() =>