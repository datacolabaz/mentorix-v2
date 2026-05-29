/** İlk dərs tarixi: anchor (məs. qoşulma) dərs günü deyilsə, sonrakı ən yaxın dərs günü. */

function weekdayFromYmd(ymd) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(String(ymd))) return null
  const [y, mo, d] = String(ymd).split('-').map(Number)
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null
  return ((dt.getUTCDay() + 6) % 7) + 1
}

function nextDateForWeekday(afterYmd, weekday, ymdInclusive) {
  const [y, mo, d] = afterYmd.split('-').map(Number)
  const base = new Date(Date.UTC(y, mo - 1, d))
  const baseDow = ((base.getUTCDay() + 6) % 7) + 1
  let delta = (weekday - baseDow + 7) % 7
  if (delta === 0 && !ymdInclusive) delta = 7
  const dt = new Date(base.getTime() + delta * 86400000)
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function parseLessonWeekdays(raw) {
  if (raw == null || raw === '') return []
  if (Array.isArray(raw)) {
    return [...new Set(raw.map((x) => parseInt(String(x), 10)).filter((n) => n >= 1 && n <= 7))].sort(
      (a, b) => a - b,
    )
  }
  if (typeof raw === 'string') {
    try {
      return parseLessonWeekdays(JSON.parse(raw))
    } catch {
      return []
    }
  }
  return []
}

function parseLessonTimes(raw, lwd) {
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
  const out = {}
  for (const d of lwd) {
    const v = o[String(d)] ?? o[d]
    if (v != null && String(v).trim() !== '') out[String(d)] = String(v).slice(0, 5)
  }
  return out
}

export function alignFirstLessonYmd(anchorYmd, lessonWeekdays, lessonTimes) {
  const lwd = parseLessonWeekdays(lessonWeekdays)
  if (!anchorYmd || !lwd.length) return anchorYmd || ''
  const lt = parseLessonTimes(lessonTimes, lwd)
  const wd = weekdayFromYmd(anchorYmd)
  if (wd && lwd.includes(wd) && lt[String(wd)]) return anchorYmd
  let best = null
  for (const d of lwd) {
    if (!lt[String(d)]) continue
    const candidate = nextDateForWeekday(anchorYmd, d, true)
    if (!best || candidate < best) best = candidate
  }
  return best || anchorYmd
}
