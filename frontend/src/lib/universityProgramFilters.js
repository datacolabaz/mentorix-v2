import { FIELD_GROUPS, fieldSearchTerms, relatedFieldSlugs } from './universityFieldCatalog'
import { localizedFieldLabel as fieldLabel } from './universityFieldI18n'
import { resolveFieldFromQuery } from './universitySearch'

const FIELD_BY_VALUE = new Map(FIELD_GROUPS.flatMap((g) => g.options.map((o) => [o.value, { ...o, category: g.id }])))

const DEGREE_ALIASES = {
  BSc: ['BSc', 'Bachelor', 'Bakalavr', 'BA', 'BS', 'Undergraduate'],
  MSc: ['MSc', 'Master', 'Magistr', 'MA', 'MS', 'MBA', 'Graduate'],
  PhD: ['PhD', 'Ph.D', 'Doctorate', 'Doktorantura', 'Doctor', 'Doctoral'],
}

const DEGREE_CANONICAL = {
  BSc: ['bsc', 'bs', 'ba', 'bachelor', 'bakalavr', 'undergraduate'],
  MSc: ['msc', 'ms', 'ma', 'mba', 'master', 'magistr', 'graduate'],
  PhD: ['phd', 'doctorate', 'doctoral', 'doctor', 'doktorantura', 'doktor'],
}

function foldAz(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ə/g, 'e')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
}

export function normalizeFieldSlug(raw) {
  const token = String(raw || '').trim()
  if (!token) return null
  if (FIELD_BY_VALUE.has(token)) return token

  const fromText = resolveFieldFromQuery(token)
  if (fromText) return fromText

  const folded = foldAz(token)
  for (const [value, meta] of FIELD_BY_VALUE.entries()) {
    const labelFolded = foldAz(meta.label)
    if (labelFolded === folded || labelFolded.includes(folded) || folded.includes(labelFolded)) {
      return value
    }
  }
  return token
}

export function normalizeFieldList(values = []) {
  return [...new Set(values.map(normalizeFieldSlug).filter(Boolean))]
}

export function collectFieldSlugs(filters = {}) {
  const raw = []
  if (Array.isArray(filters.fields)) raw.push(...filters.fields)
  else if (typeof filters.fields === 'string' && filters.fields.trim()) {
    raw.push(...filters.fields.split(','))
  }
  if (filters.field) raw.push(filters.field)
  if (filters.q) {
    const resolved = resolveFieldFromQuery(filters.q)
    if (resolved) raw.push(resolved)
  }
  return normalizeFieldList(raw)
}

export function programMatchesDegree(program, degreeLevel) {
  if (!degreeLevel) return true
  const level = String(program.degree_level || '').toLowerCase().replace(/\./g, '')
  const canonical = DEGREE_CANONICAL[degreeLevel] || [String(degreeLevel).toLowerCase()]
  if (canonical.includes(level)) return true
  const patterns = (DEGREE_ALIASES[degreeLevel] || [degreeLevel]).map((a) => a.toLowerCase())
  return patterns.some((p) => level.includes(p) || p.includes(level))
}

export function programMatchesAnyField(program, fieldSlugs) {
  if (!fieldSlugs?.length) return true
  return fieldSlugs.some((slug) => {
    const normalized = normalizeFieldSlug(slug)
    if (relatedFieldSlugs(normalized).includes(program.field)) return true
    const terms = fieldSearchTerms(normalized)
    const label = fieldLabel(normalized)
    const blob = [program.field, program.field_category, program.name, program.university?.name, label]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return terms.some((t) => blob.includes(String(t).toLowerCase()))
  })
}

export function programMatchesUserIelts(program, userIelts) {
  if (userIelts == null) return true
  const req = Number(
    program.requirements?.min_language?.ielts
    ?? program.requirements?.min_ielts
    ?? program.requirements?.ielts,
  )
  return !Number.isFinite(req) || req <= userIelts
}

export function programMatchesUserToefl(program, userToefl) {
  if (userToefl == null) return true
  const req = Number(
    program.requirements?.min_language?.toefl
    ?? program.requirements?.min_toefl
    ?? program.requirements?.toefl,
  )
  return !Number.isFinite(req) || req <= userToefl
}

export function programMatchesUniversityType(program, universityType) {
  if (!universityType) return true
  return program.university?.university_type === universityType
}

export function buildEmptyResultsMessage(filters = {}) {
  const slugs = collectFieldSlugs(filters)
  const labels = slugs.map((slug) => fieldLabel(slug) || slug.replace(/_/g, ' '))
  const fieldLabelText = labels.length ? labels.join(', ') : 'seçilmiş ixtisas'
  const degree = filters.degreeLevel || filters.degree_level || ''
  const degreeAz = {
    BSc: 'Bakalavr (BSc)',
    MSc: 'Magistr (MSc)',
    PhD: 'Doktorantura (PhD)',
  }[degree]

  if (degree === 'PhD') {
    return `${fieldLabelText} üzrə PhD proqramları hazırda yüklənir. Nümunə üçün "Magistr (MSc)" dərəcəsini seçib yoxlaya bilərsiniz.`
  }
  if (degree && degreeAz) {
    return `${fieldLabelText} üzrə ${degreeAz} proqramları hazırda məhduddur. Filtrləri genişləndirin və ya başqa dərəcə sınayın.`
  }
  if (slugs.length) {
    return `${fieldLabelText} üzrə uyğun proqram hazırda tapılmadı. Ölkə və ya dərəcə filtrini dəyişməyi sınayın.`
  }
  return 'Uyğun proqram tapılmadı. Filtrləri dəyişdirin.'
}

export function resolveFieldFromText(text) {
  return resolveFieldFromQuery(text)
}

export { DEGREE_ALIASES, DEGREE_CANONICAL, FIELD_GROUPS }
