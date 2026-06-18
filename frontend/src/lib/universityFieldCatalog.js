/** Frontend ixtisas kataloqu (backend ilə uyğun) */

export const FIELD_GROUPS = [
  {
    id: 'cs',
    label: 'Kompüter Elmləri',
    options: [
      { value: 'computer_science', label: 'Kompüter Elmləri (Computer Science)' },
      { value: 'software_engineering', label: 'Proqram Mühəndisliyi (Software Engineering)' },
      { value: 'data_science', label: 'Data Science' },
      { value: 'artificial_intelligence', label: 'Süni İntellekt (AI)' },
      { value: 'cybersecurity', label: 'Kibertəhlükəsizlik (Cybersecurity)' },
      { value: 'information_technology', label: 'İnformasiya Texnologiyaları (IT)' },
      { value: 'game_development', label: 'Oyun İnkişafı (Game Development)' },
    ],
  },
  {
    id: 'business',
    label: 'Biznes / İdarəetmə',
    options: [
      { value: 'business_administration', label: 'Biznesin İdarə Edilməsi' },
      { value: 'finance', label: 'Maliyyə (Finance)' },
      { value: 'accounting', label: 'Mühasibatlıq' },
      { value: 'marketing', label: 'Marketinq' },
      { value: 'human_resources', label: 'İnsan Resursları' },
      { value: 'international_business', label: 'Beynəlxalq Biznes' },
      { value: 'logistics', label: 'Logistika və Təchizat Zənciri' },
    ],
  },
  {
    id: 'engineering',
    label: 'Mühəndislik',
    options: [
      { value: 'chemical_engineering', label: 'Kimya Mühəndisliyi' },
      { value: 'electrical_engineering', label: 'Elektrik və Elektronika Mühəndisliyi' },
      { value: 'computer_engineering', label: 'Kompüter Mühəndisliyi' },
      { value: 'mechanical_engineering', label: 'Mexanika Mühəndisliyi' },
      { value: 'civil_engineering', label: 'İnşaat Mühəndisliyi' },
      { value: 'industrial_engineering', label: 'Sənaye Mühəndisliyi' },
      { value: 'petroleum_engineering', label: 'Neft və Qaz Mühəndisliyi' },
    ],
  },
  {
    id: 'life_sciences',
    label: 'Həyat Elmləri',
    options: [
      { value: 'chemistry', label: 'Kimya' },
      { value: 'biology', label: 'Biologiya' },
      { value: 'biochemistry', label: 'Biokimya' },
      { value: 'biotechnology', label: 'Biotexnologiya' },
      { value: 'pharmacy', label: 'Əczaçılıq (Pharmacy)' },
      { value: 'medicine', label: 'Tibb' },
      { value: 'environmental_science', label: 'Ətraf Mühit Elmləri' },
    ],
  },
]

const FIELD_BY_VALUE = new Map(
  FIELD_GROUPS.flatMap((g) => g.options.map((o) => [o.value, { ...o, category: g.id }])),
)

const FIELD_MATCH_TERMS = {
  computer_science: ['CS', 'Computer Science', 'computer', 'informatics'],
  software_engineering: ['Software', 'CS', 'computer', 'engineering'],
  data_science: ['Data Science', 'data', 'analytics', 'CS'],
  artificial_intelligence: ['AI', 'Artificial', 'Machine Learning', 'CS'],
  cybersecurity: ['Cyber', 'Security', 'Information Security', 'IT'],
  information_technology: ['IT', 'Information Technology', 'Informatics'],
  game_development: ['Game', 'Gaming', 'CS', 'Software'],
  business_administration: ['Business', 'Management', 'MBA'],
  finance: ['Finance', 'Financial', 'Business'],
  accounting: ['Accounting', 'Finance', 'Business'],
  marketing: ['Marketing', 'Business'],
  human_resources: ['Human Resources', 'HR', 'Business'],
  international_business: ['International Business', 'Business'],
  logistics: ['Logistics', 'Supply Chain', 'Business'],
  chemical_engineering: ['Chemical', 'Engineering', 'Chemistry'],
  electrical_engineering: ['Electrical', 'Electronics', 'Engineering'],
  computer_engineering: ['Computer Engineering', 'Electrical', 'CS', 'Engineering'],
  mechanical_engineering: ['Mechanical', 'Engineering'],
  civil_engineering: ['Civil', 'Construction', 'Engineering'],
  industrial_engineering: ['Industrial', 'Engineering', 'Management'],
  petroleum_engineering: ['Petroleum', 'Oil', 'Gas', 'Engineering'],
  chemistry: ['Chemistry', 'Chemical', 'Kimya', 'Life Sciences'],
  biology: ['Biology', 'Life Sciences', 'Biological'],
  biochemistry: ['Biochemistry', 'Biology', 'Chemistry'],
  biotechnology: ['Biotechnology', 'Biology', 'Life Sciences'],
  pharmacy: ['Pharmacy', 'Pharmaceutical', 'Life Sciences'],
  medicine: ['Medicine', 'Medical', 'MBBS', 'Life Sciences'],
  environmental_science: ['Environment', 'Environmental', 'Ecology', 'Life Sciences'],
}

const FIELD_RELATED_SLUGS = {
  chemistry: ['chemistry', 'chemical_engineering', 'biochemistry', 'pharmacy'],
  chemical_engineering: ['chemical_engineering', 'chemistry', 'biochemistry'],
  biochemistry: ['biochemistry', 'chemistry', 'biology', 'biotechnology'],
  biology: ['biology', 'biochemistry', 'biotechnology', 'medicine'],
  pharmacy: ['pharmacy', 'chemistry', 'biochemistry'],
}

export function relatedFieldSlugs(slug) {
  const key = String(slug || '').trim()
  if (!key) return []
  return [...new Set([key, ...(FIELD_RELATED_SLUGS[key] || [])])]
}

export function fieldLabel(slug) {
  return FIELD_BY_VALUE.get(slug)?.label || slug
}

export function fieldSearchTerms(slug) {
  const key = String(slug || '').trim()
  if (!key) return []
  const explicit = FIELD_MATCH_TERMS[key] || []
  const meta = FIELD_BY_VALUE.get(key)
  const fromLabel = meta?.label
    ? meta.label
        .replace(/\([^)]*\)/g, '')
        .split(/[/,]/)
        .map((s) => s.trim())
        .filter(Boolean)
    : []
  return [...new Set([key.replace(/_/g, ' '), ...explicit, ...fromLabel])]
}
