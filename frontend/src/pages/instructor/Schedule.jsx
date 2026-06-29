import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import ListSkeleton from '../../components/common/ListSkeleton'
import Modal from '../../components/common/Modal'
import {
  fmtTime,
  slotTimesForLesson,
  parseLessonInstant,
  parseEnrollmentLessonTimes,
  bakuPartsFromInstant,
  parseToMinutes,
  slotCoversHour,
  slotFirstHour,
  GRID_START,
  GRID_END,
  GRID_ROW_COUNT,
} from '../../lib/lessonWeekGrid'
import { readCache, writeCache } from '../../lib/cache'
import { getWeekdays } from '../../lib/weekdays'

/** @deprecated Use getWeekdays(t) from ../../lib/weekdays */
export const WEEKDAYS = [
  { v: 1, short: 'B.e.', full: 'Bazar ertəsi' },
  { v: 2, short: 'Ç.a.', full: 'Çərşənbə axşamı' },
  { v: 3, short: 'Çər.', full: 'Çərşənbə' },
  { v: 4, short: 'C.a.', full: 'Cümə axşamı' },
  { v: 5, short: 'Cümə', full: 'Cümə' },
  { v: 6, short: 'Şən.', full: 'Şənbə' },
  { v: 7, short: 'Baz.', full: 'Bazar' },
]

function fmtLocaleBakuDate(inst, locale) {
  if (!inst || Number.isNaN(inst.getTime())) return ''
  const parts = new Intl.DateTimeFormat(locale, {
    timeZone: 'Asia/Baku',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(inst)
  const pick = (type) => parts.find((p) => p.type === type)?.value
  const y = pick('year')
  const mo = pick('month')
  const d = pick('day')
  if (y && mo && d) return `${String(d).padStart(2, '0')}.${String(mo).padStart(2, '0')}.${y}`
  return '—'
}

function fmtLocaleBakuClockHm(inst) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Baku',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(inst)
  const pick = (type) => parts.find((p) => p.type === type)?.value
  const h = pick('hour') ?? '00'
  const m = pick('minute') ?? '00'
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function fmtLocaleLessonRow(l, locale) {
  const inst = parseLessonInstant(l?.lesson_date)
  if (!inst) return '—'
  const dateStr = fmtLocaleBakuDate(inst, locale)
  const { dow } = bakuPartsFromInstant(inst)
  const lt = parseEnrollmentLessonTimes(l.enrollment_lesson_times)
  const wall = dow != null ? lt[String(dow)] ?? lt[dow] : null
  const timeStr = wall != null && wall !== '' ? fmtTime(wall) : ''
  if (timeStr) {
    const parts = bakuPartsFromInstant(inst)
    const actualMin = parts.hour * 60 + parts.minute
    const [h, m] = timeStr.split(':').map((x) => parseInt(x, 10))
    const wallMin = (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)
    if (Math.abs(actualMin - wallMin) <= 10) return `${dateStr}, ${timeStr}`
  }
  return `${dateStr}, ${fmtLocaleBakuClockHm(inst)}`
}

/**
 * @typedef {{ day_of_week: number, start_time: string, end_time: string }} SlotFilter
 * @typedef {{ phase: 'pickStudent', slotSubtitle: string, studentNames: string[], slotFilter: SlotFilter }} PickState
 * @typedef {{ phase: 'lessons', slotSubtitle: string, studentNames: string[], slotFilter: SlotFilter, studentName: string, lessons: object[] }} LessonsState
 */

export default function InstructorSchedule() {
  const { t, i18n } = useTranslation()
  const dateLocale = i18n.language.startsWith('ru') ? 'ru-RU' : 'az-AZ'
  const weekdays = useMemo(() => getWeekdays(t), [t])
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
        setErr(e?.message || t('schedule.loadFailed'))
        setDatedLessons([])
      }
    } finally {
      if (!quiet) setLoading(false)
    }
  }, [t])

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
      const name = (l.student_name || '').trim() || t('schedule.defaultStudent')
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
  }, [datedLessons, t])

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
      studentNames: primary.studentNames?.length ? [...primary.studentNames] : [t('schedule.defaultStudent')],
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
          <h1 className="font-display font-bold text-xl sm:text-2xl text-token-textMain tracking-tight">{t('schedule.title')}</h1>
          <p className="text-token-textMuted text-xs sm:text-sm mt-1 leading-relaxed line-clamp-4 sm:line-clamp-none">
            {t('schedule.subtitle.beforeMap')}{' '}
            <span className="text-token-textMain">{t('schedule.subtitle.mapHighlight')}</span>
            {t('schedule.subtitle.afterMap')}{' '}
            <span className="text-token-textMain">{t('schedule.subtitle.dateHighlight')}</span>
            {t('schedule.subtitle.afterDate')}
          </p>
        </div>
        <Button type="button" variant="secondary" size="sm" className="w-full sm:w-auto justify-center" onClick={() => void load()} disabled={loading}>
          {t('schedule.refresh')}
        </Button>
      </div>

      <Card hover className="p-4 sm:p-5">
        {loading ? (
          <div className="py-10">
            <ListSkeleton message={t('schedule.loading')} />
          </div>
        ) : err ? (
          <div className="text-center text-amber-200/90 text-sm py-8">
            {err}
            <div className="mt-3">
              <Button type="button" size="sm" onClick={() => void load()}>
                {t('schedule.retry')}
              </Button>
            </div>
          </div>
        ) : datedLessons.length === 0 ? (
          <p className="text-sm text-token-textMuted py-8 text-center">{t('schedule.empty')}</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-4 text-xs text-token-textMuted mb-3">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-primary/20 border border-primary/30" /> {t('schedule.legendLesson')}
              </span>
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-token-surfaceCard/50 border border-[color:var(--border-subtle)]" /> {t('schedule.legendEmpty')}
              </span>
            </div>
            <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
              <div
                className="grid gap-px bg-[color:var(--border-subtle)] rounded-xl overflow-hidden border border-[color:var(--border-subtle)] min-w-[680px] max-h-[70vh] overflow-y-auto"
                style={{
                  gridTemplateColumns: `3.5rem repeat(7, minmax(0,1fr))`,
                  gridTemplateRows: `auto repeat(${gridRowCount}, minmax(2rem, 2.25rem))`,
                }}
              >
                <div className="bg-token-surfaceCard/55 p-2 text-[10px] font-semibold text-token-textMuted uppercase tracking-wider" />
                {weekdays.map((d) => (
                  <div
                    key={d.v}
                    className="bg-token-surfaceCard/55 p-2 text-center text-[11px] font-bold text-token-textMain border-l border-[color:var(--border-subtle)]"
                  >
                    {d.short}
                  </div>
                ))}
                {Array.from({ length: gridRowCount }, (_, i) => GRID_START + i).map((hour) => (
                  <Fragment key={`h-${hour}`}>
                    <div className="bg-token-surfaceCard/40 text-[10px] text-token-textMuted font-mono tabular-nums flex items-center justify-end pr-2 border-t border-[color:var(--border-subtle)]">
                      {String(hour).padStart(2, '0')}:00
                    </div>
                    {weekdays.map((d) => {
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
                      const countLabel = n <= 1 ? t('schedule.studentCountOne') : t('schedule.studentCount', { count: n })
                      return (
                        <div
                          key={`c-${d.v}-${hour}`}
                          className="bg-token-surfaceMain/30 border-l border-t border-[color:var(--border-subtle)] relative min-h-[2.25rem]"
                        >
                          {isFirstHour && primary && (
                            <button
                              type="button"
                              className="absolute left-0.5 right-0.5 rounded-md border px-1 py-1 text-[10px] leading-tight z-10 shadow-sm text-left bg-token-surfaceCard/55 border-[color:var(--border-subtle)] text-token-textMain cursor-pointer hover:bg-token-surfaceCardHover/80 hover:border-primary/25 active:scale-[0.99] transition-colors min-h-[2rem]"
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
        title={cellModal?.phase === 'lessons' ? cellModal.studentName : t('schedule.modalTitleDefault')}
        size="sm"
      >
        {cellModal?.slotSubtitle ? (
          <p className="text-xs text-gray-400 mb-3 font-mono tabular-nums">{cellModal.slotSubtitle}</p>
        ) : null}

        {cellModal?.phase === 'pickStudent' && (
          <>
            <p className="text-xs text-gray-500 mb-3">
              {t('schedule.pickStudentHint')}
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
                <span className="text-indigo-200/95 font-semibold">{t('schedule.sampleNoteTitle')}</span>{' '}
                {t('schedule.sampleNote')}
              </p>
            ) : (
              <p className="text-[10px] text-gray-500 leading-relaxed mb-2">
                {t('schedule.packageNoteBefore')}{' '}
                <span className="text-gray-300">{t('schedule.packageNoteHighlight')}</span>{' '}
                {t('schedule.packageNoteAfter')}
              </p>
            )}
            <div className="flex items-center justify-between gap-2 mb-3">
              <p className="text-xs text-gray-500">
                {cellModal.lessons.some((l) => l.status === 'monthly_grid') ? (
                  <>
                    {t('schedule.sampleCount', { count: cellModal.lessons.length })}
                  </>
                ) : (
                  <>
                    {t('schedule.totalCount', { count: cellModal.lessons.length })}
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
                {t('schedule.backToStudents')}
              </button>
            </div>
            <ul className="space-y-2 max-h-[50vh] overflow-y-auto">
              {cellModal.lessons.map((l) => (
                <li
                  key={l.id}
                  className="rounded-xl border border-indigo-500/15 bg-[#0f0c29]/80 px-3 py-2 text-sm text-gray-200 font-mono"
                >
                  {fmtLocaleLessonRow(l, dateLocale)}
                </li>
              ))}
            </ul>
          </>
        )}

        <Button type="button" variant="secondary" className="w-full mt-5 justify-center" onClick={() => setCellModal(null)}>
          {t('schedule.close')}
        </Button>
      </Modal>
    </div>
  )
}
