import { FIELD_GROUPS } from './universityFieldCatalog'
import { fieldSearchTerms, relatedFieldSlugs, resolveFieldFromQuery } from './universitySearch'

const DEGREE_ALIASES = {
  BSc: ['BSc', 'Bachelor', 'Bakalavr', 'BA', 'BS', 'Undergraduate'],
  MSc: ['MSc', 'Master', 'Magistr', 'MA', 'MS', 'MBA', 'Graduate'],
  PhD: ['PhD', 'Doctorate', 'Doktorantura', 'Doctor', 'Doctoral'],
}

export function collectFieldSlugs(filters = {}) {
  const slugs = new Set()
  const add = (v) => {
    if (Array.isArray(v)) v.forEach((x) => slugs.add(x))
    else if (typeof v === 'string' && v.trim()) {
      v.split(',').forEach((x) => slugs.add(x.trim()))
    }
  }
  add(filters.fields)
  add(filters.field)
  if (filters.q) {
    const resolved = resolveFieldFromQuery(filters.q)
    if (resolved) slugs.add(resolved)
  }
  return [...slugs].filter(Boolean)
}

export function programMatchesDegree(program, degreeLevel) {
  if (!degreeLevel) return true
  const level = String(program.degree_level || '').toLowerCase()
  const patterns = (DEGREE_ALIASES[degreeLevel] || [degreeLevel]).map((a) => a.toLowerCase())
  return patterns.some((p) => level.includes(p) || p.includes(level))
}

export function programMatchesAnyField(program, fieldSlugs) {
  if (!fieldSlugs?.length) return true
  return fieldSlugs.some((slug) => {
    if (relatedFieldSlugs(slug).includes(program.field)) return true
    const terms = fieldSearchTerms(slug)
    const blob = [program.field, program.field_category, program.name, program.university?.name]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return terms.some((t) => blob.includes(String(t).toLowerCase()))
  })
}

export function programMatchesUserIelts(program, userIelts) {
  if (userIelts == null) return true
  const req = Number(program.requirements?.min_language?.ielts ?? program.requirements?.min_ielts)
  return !Number.isFinite(req) || req <= userIelts
}

export function resolveFieldFromText(text) {
  return resolveFieldFromQuery(text)
}

export { DEGREE_ALIASES, FIELD_GROUPS }
