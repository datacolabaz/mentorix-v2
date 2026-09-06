import { resolveUiLocale } from './uiLocale'

const FORMAT_BY_ENUM = {
  online: { az: 'Onlayn', en: 'Online', ru: 'Онлайн' },
  teacher_place: { az: 'Müəllimin ünvanında', en: "At the teacher's", ru: 'У учителя' },
  student_place: { az: 'Tələbənin ünvanında', en: 'At the student\'s', ru: 'У ученика' },
}

const FORMAT_BY_AZ = {
  onlayn: 'online',
  əyani: 'teacher_place',
  'müəllimin ünvanında': 'teacher_place',
  'tələbənin ünvanında': 'student_place',
  'tələbənin yanında': 'student_place',
}

const WEEKDAY = {
  1: { az: 'Bazar ertəsi', en: 'Monday', ru: 'Понедельник' },
  2: { az: 'Çərşənbə axşamı', en: 'Tuesday', ru: 'Вторник' },
  3: { az: 'Çərşənbə', en: 'Wednesday', ru: 'Среда' },
  4: { az: 'Cümə axşamı', en: 'Thursday', ru: 'Четверг' },
  5: { az: 'Cümə', en: 'Friday', ru: 'Пятница' },
  6: { az: 'Şənbə', en: 'Saturday', ru: 'Суббота' },
  7: { az: 'Bazar', en: 'Sunday', ru: 'Воскресенье' },
}

const RELATIVE = {
  'bu gün': { en: 'Today', ru: 'Сегодня' },
  sabah: { en: 'Tomorrow', ru: 'Завтра' },
}

export function localizeFormatLabel(raw, lang) {
  const locale = resolveUiLocale(lang)
  const s = String(raw || '').trim()
  if (!s) return s
  if (FORMAT_BY_ENUM[s]) return FORMAT_BY_ENUM[s][locale] || s
  const enumKey = FORMAT_BY_AZ[s.toLowerCase()]
  if (enumKey) return FORMAT_BY_ENUM[enumKey][locale] || s
  return s
}

export function localizeFormatBadges(labels, lang) {
  if (!Array.isArray(labels)) return []
  return [...new Set(labels.map((x) => localizeFormatLabel(x, lang)).filter(Boolean))]
}

export function localizeNextSlotLabel(raw, lang) {
  const locale = resolveUiLocale(lang)
  const s = String(raw || '').trim()
  if (!s || locale === 'az') return s
  const [dayPart, ...rest] = s.split(',')
  const time = rest.join(',').trim()
  const dayKey = String(dayPart || '').trim().toLowerCase()
  const rel = RELATIVE[dayKey]
  if (rel) return time ? `${rel[locale]}, ${time}` : rel[locale]
  for (const row of Object.values(WEEKDAY)) {
    if (row.az.toLowerCase() === dayKey) {
      return time ? `${row[locale]}, ${time}` : row[locale]
    }
  }
  return s
}

export function instructorRoleLabel(kind, lang) {
  const locale = resolveUiLocale(lang)
  const trainer = kind === 'trainer'
  if (locale === 'en') return trainer ? 'Trainer' : 'Teacher'
  if (locale === 'ru') return trainer ? 'Тренер' : 'Учитель'
  return trainer ? 'Təlimçi' : 'Müəllim'
}
