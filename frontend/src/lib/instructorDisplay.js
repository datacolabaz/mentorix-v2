import { localizeTeachingCategoryList, localizeTeachingCategoryName } from './teachingCategoryI18n'

/** İctimai siyahıda göstəriləcək fənn/sahə sətri */
export function instructorDisplaySubject(p, lang = 'az') {
  if (p?.display_subject) return localizeTeachingCategoryName(p.display_subject, lang)
  const cats = Array.isArray(p?.category_names) ? p.category_names.filter(Boolean) : []
  if (cats.length) return localizeTeachingCategoryList(cats, lang).join(', ')
  const sub = String(p?.subject || '').trim()
  if (sub && sub !== '—') return localizeTeachingCategoryName(sub, lang)
  return null
}
