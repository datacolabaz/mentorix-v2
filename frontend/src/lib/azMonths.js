import { resolveUiLocale } from './uiLocale.js'

/** Explicit names — never Intl month:short (some engines emit M01 / English / MO). */
export const MONTHS_LONG = {
  az: [
    'Yanvar',
    'Fevral',
    'Mart',
    'Aprel',
    'May',
    'İyun',
    'İyul',
    'Avqust',
    'Sentyabr',
    'Oktyabr',
    'Noyabr',
    'Dekabr',
  ],
  en: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
  ru: [
    'Январь',
    'Февраль',
    'Март',
    'Апрель',
    'Май',
    'Июнь',
    'Июль',
    'Август',
    'Сентябрь',
    'Октябрь',
    'Ноябрь',
    'Декабрь',
  ],
}

export const MONTHS_SHORT = {
  az: ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avq', 'sen', 'okt', 'noy', 'dek'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  ru: ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
}

const WEEKDAYS_LONG = {
  az: ['bazar', 'bazar ertəsi', 'çərşənbə axşamı', 'çərşənbə', 'cümə axşamı', 'cümə', 'şənbə'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  ru: ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'],
}

function langKey(lang) {
  const l = resolveUiLocale(lang)
  return MONTHS_LONG[l] ? l : 'az'
}

export function monthLong(index, lang, { lower } = {}) {
  const list = MONTHS_LONG[langKey(lang)]
  const s = list[index] || ''
  if (lower && langKey(lang) === 'az') return s.toLocaleLowerCase('az')
  return s
}

export function monthShort(index, lang) {
  const list = MONTHS_SHORT[langKey(lang)]
  return list[index] || ''
}

/** `2026-09` → `sen` / `Sep` / `сен` */
export function formatYmMonthShort(ym, lang) {
  const m = Number(String(ym || '').split('-')[1])
  if (!Number.isFinite(m) || m < 1 || m > 12) return String(ym || '')
  return monthShort(m - 1, lang)
}

export function bakuDateParts(value, timeZone = 'Asia/Baku') {
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d)
  const get = (t) => parts.find((p) => p.type === t)?.value
  const monthNum = Number(get('month'))
  const dayNum = Number(get('day'))
  const yearNum = Number(get('year'))
  if (!monthNum || !dayNum || !yearNum) return null
  const weekdayIndex = new Date(Date.UTC(yearNum, monthNum - 1, dayNum, 12, 0, 0)).getUTCDay()
  return {
    day: dayNum,
    monthIndex: monthNum - 1,
    year: yearNum,
    hour: get('hour'),
    minute: get('minute'),
    weekdayIndex,
  }
}

/**
 * Named month from our tables (not Intl). Example: `8 sentyabr 2026`.
 * @param {'short' | 'long'} [opts.month]
 */
export function formatNamedDate(value, lang, opts = {}) {
  const p = bakuDateParts(value, opts.timeZone)
  if (!p) return ''
  const month =
    opts.month === 'short'
      ? monthShort(p.monthIndex, lang)
      : monthLong(p.monthIndex, lang, { lower: langKey(lang) === 'az' })
  const day = opts.padDay ? String(p.day).padStart(2, '0') : String(p.day)
  let out = `${day} ${month} ${p.year}`
  if (opts.weekday) {
    const wd = (WEEKDAYS_LONG[langKey(lang)] || WEEKDAYS_LONG.az)[p.weekdayIndex]
    out = `${out}, ${wd}`
  }
  if (opts.time && p.hour != null && p.minute != null) {
    out += `${opts.timeSep || ', '} ${p.hour}:${p.minute}`
  }
  return out
}

export function formatNumericDate(value, opts = {}) {
  const p = bakuDateParts(value, opts.timeZone)
  if (!p) return ''
  const dd = String(p.day).padStart(2, '0')
  const mm = String(p.monthIndex + 1).padStart(2, '0')
  return `${dd}.${mm}.${p.year}`
}

/** `15.01.2026, 12:00` — rəqəmli ay, heç vaxt M01/MO1. */
export function formatNumericDateTime(value, opts = {}) {
  const p = bakuDateParts(value, opts.timeZone)
  if (!p) return ''
  const date = `${String(p.day).padStart(2, '0')}.${String(p.monthIndex + 1).padStart(2, '0')}.${p.year}`
  if (p.hour == null || p.minute == null) return date
  return `${date}${opts.sep || ', '}${p.hour}:${p.minute}`
}
