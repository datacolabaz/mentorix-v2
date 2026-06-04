/** İctimai siyahıda göstəriləcək fənn/sahə sətri */
export function instructorDisplaySubject(p) {
  if (p?.display_subject) return p.display_subject
  const cats = Array.isArray(p?.category_names) ? p.category_names.filter(Boolean) : []
  if (cats.length) return cats.join(', ')
  const sub = String(p?.subject || '').trim()
  if (sub && sub !== '—') return sub
  return null
}
