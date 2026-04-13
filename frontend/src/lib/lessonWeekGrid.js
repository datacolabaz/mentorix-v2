/** Həftəlik dərs şəbəkəsi: lesson_date + enrollment lesson_times (Baku, UTC sürüşməsinə qarşı). */

export function fmtTime(t) {
  if (!t) return ''
  const s = typeof t === 'string' ? t : String(t)
  return s.slice(0, 5)
}

const EN_SHORT_DOW = { Sun: 7, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

export function parseLessonInstant(dt) {
  if (!dt) return null
  const s = String(dt).trim()
  const hasTz = /([zZ]|[+-]\d{2}:?\d{2})$/.test(s)
  if (hasTz) {
    const d = new Date(s.includes('T') ? s : s.replace(' ', 'T'))
    return Number.isNaN(d.getTime()) ? null : d
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(s)
  if (!m) {
    const d = new Date(s)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const hh = Number(m[4])
  const mm = Number(m[5])
  const ss = m[6] != null ? Number(m[6]) : 0
  const ms = Date.UTC(y, mo - 1, d, hh - 4, mm, ss)
  const out = new Date(ms)
  return Number.isNaN(out.getTime()) ? null : out
}

export function bakuPartsFromInstant(inst) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Baku',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(inst)
  const get = (t) => parts.find((p) => p.type === t)?.value
  const wd = EN_SHORT_DOW[get('weekday')] || null
  const hour = parseInt(get('hour') || '0', 10)
  const minute = parseInt(get('minute') || '0', 10)
  return { dow: wd, hour: Number.isFinite(hour) ? hour : 0, minute: Number.isFinite(minute) ? minute : 0 }
}

export function parseEnrollmentLessonTimes(raw) {
  if (raw == null || raw === '') return {}
  let o = raw
  if (typeof raw === 'string') {
    try {
      o = JSON.parse(raw)
    } catch {
      return {}
    }
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return {}
  return o
}

/** @returns {{ day: number, start: string, end: string } | null} */
export function slotTimesForLesson(l) {
  if (!l?.lesson_date) return null
  const inst = parseLessonInstant(l.lesson_date)
  if (!inst) return null
  const { dow: day, hour: sh, minute: sm } = bakuPartsFromInstant(inst)
  if (!day) return null
  const lt = parseEnrollmentLessonTimes(l.enrollment_lesson_times)
  const wall = lt[String(day)] ?? lt[day]
  let hh = sh
  let mm = sm
  const wt = wall != null && wall !== '' ? fmtTime(wall) : ''
  if (wt) {
    const [h, m] = wt.split(':').map((x) => parseInt(x, 10))
    if (Number.isFinite(h) && Number.isFinite(m)) {
      hh = h
      mm = m
    }
  }
  const startMin = hh * 60 + mm
  const endMin = startMin + 60
  const eh = String(Math.floor(endMin / 60) % 24).padStart(2, '0')
  const em = String(endMin % 60).padStart(2, '0')
  const start = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
  const end = `${eh}:${em}`
  return { day, start, end }
}

export function fmtAzBakuLessonRow(l) {
  const inst = parseLessonInstant(l?.lesson_date)
  if (!inst) return '—'
  const dateStr = new Intl.DateTimeFormat('az-AZ', {
    timeZone: 'Asia/Baku',
    dateStyle: 'medium',
  }).format(inst)
  const { dow } = bakuPartsFromInstant(inst)
  const lt = parseEnrollmentLessonTimes(l.enrollment_lesson_times)
  const wall = dow != null ? lt[String(dow)] ?? lt[dow] : null
  const t = wall != null && wall !== '' ? fmtTime(wall) : ''
  if (t) return `${dateStr}, ${t}`
  try {
    return new Intl.DateTimeFormat('az-AZ', {
      timeZone: 'Asia/Baku',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(inst)
  } catch {
    return dateStr
  }
}

export function parseToMinutes(t) {
  const s = fmtTime(t)
  const [h, m] = s.split(':').map((x) => parseInt(x, 10))
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)
}

export function slotCoversHour(slot, hour) {
  const sm = parseToMinutes(slot.start_time)
  const em = parseToMinutes(slot.end_time)
  const rowStart = hour * 60
  const rowEnd = (hour + 1) * 60
  return sm < rowEnd && em > rowStart
}

export function slotFirstHour(slot) {
  return Math.floor(parseToMinutes(slot.start_time) / 60)
}

export const GRID_START = 8
export const GRID_END = 20
export const GRID_ROW_COUNT = GRID_END - GRID_START
