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
      // Only trust enrollment wall-time if it matches the actual lesson_date closely.
      // Otherwise (e.g. lesson_times edited later) keep real timestamp so schedule shows true conflicts.
      const actualMin = sh * 60 + sm
      const wallMin = h * 60 + m
      const diff = Math.abs(actualMin - wallMin)
      if (diff <= 10) {
        hh = h
        mm = m
      }
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

/** Bakı təqvimi: DD.MM.YYYY — `az-AZ` + dateStyle bəzi brauzerlərdə «M04» kimi səhv ay göstərir. */
export function fmtAzBakuDate(inst) {
  if (!inst || Number.isNaN(inst.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Baku',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(inst)
  const pick = (t) => parts.find((p) => p.type === t)?.value
  const y = pick('year')
  const mo = pick('month')
  const d = pick('day')
  if (y && mo && d) return `${String(d).padStart(2, '0')}.${String(mo).padStart(2, '0')}.${y}`
  return '—'
}

function fmtAzBakuClockHm(inst) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Baku',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(inst)
  const pick = (t) => parts.find((p) => p.type === t)?.value
  const h = pick('hour') ?? '00'
  const m = pick('minute') ?? '00'
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function fmtAzBakuLessonRow(l) {
  const inst = parseLessonInstant(l?.lesson_date)
  if (!inst) return '—'
  const dateStr = fmtAzBakuDate(inst)
  const { dow } = bakuPartsFromInstant(inst)
  const lt = parseEnrollmentLessonTimes(l.enrollment_lesson_times)
  const wall = dow != null ? lt[String(dow)] ?? lt[dow] : null
  const t = wall != null && wall !== '' ? fmtTime(wall) : ''
  if (t) {
    const parts = bakuPartsFromInstant(inst)
    const actualMin = parts.hour * 60 + parts.minute
    const [h, m] = t.split(':').map((x) => parseInt(x, 10))
    const wallMin = (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)
    if (Math.abs(actualMin - wallMin) <= 10) return `${dateStr}, ${t}`
  }
  return `${dateStr}, ${fmtAzBakuClockHm(inst)}`
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
