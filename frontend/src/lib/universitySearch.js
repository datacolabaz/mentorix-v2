/** @typedef {'BSc' | 'MSc' | 'PhD'} DegreeLevel */

/**
 * @typedef {Object} UniversitySearchWizardState
 * @property {DegreeLevel | ''} degreeLevel
 * @property {string} field
 * @property {number | ''} gpa
 * @property {'ielts' | 'toefl' | ''} languageType
 * @property {number | ''} languageScore
 * @property {string[]} countries
 * @property {string} budgetRange
 * @property {number | ''} durationYears
 */

export { FIELD_GROUPS, fieldLabel, fieldSearchTerms } from './universityFieldCatalog'
export {
  UNIVERSITY_COUNTRIES,
  MVP_COUNTRIES,
  COUNTRY_FLAGS,
  countryFlag,
  filterCountriesByQuery,
} from './universityCountries'

import { FIELD_GROUPS, fieldSearchTerms } from './universityFieldCatalog'

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

const FIELD_QUERY_ALIASES = [
  { keys: ['computer science', 'kompüter elmləri', 'informatika', 'cs'], value: 'computer_science' },
  { keys: ['data science', 'data'], value: 'data_science' },
  { keys: ['artificial intelligence', 'suni intellekt', ' ai ', 'machine learning'], value: 'artificial_intelligence' },
  { keys: ['software engineering', 'proqram mühəndisliyi'], value: 'software_engineering' },
  { keys: ['business', 'biznes', 'mba'], value: 'business_administration' },
  { keys: ['finance', 'maliyyə'], value: 'finance' },
  { keys: ['chemistry', 'kimya'], value: 'chemistry' },
  { keys: ['medicine', 'tibb'], value: 'medicine' },
  { keys: ['cybersecurity', 'kibertəhlükəsizlik'], value: 'cybersecurity' },
]

export function resolveFieldFromQuery(query) {
  const folded = foldAz(query).trim()
  if (!folded || folded.length < 2) return null

  for (const alias of FIELD_QUERY_ALIASES) {
    if (alias.keys.some((k) => folded.includes(foldAz(k)))) return alias.value
  }

  for (const group of FIELD_GROUPS) {
    for (const opt of group.options) {
      const labelFolded = foldAz(opt.label)
      const valueFolded = foldAz(opt.value.replace(/_/g, ' '))
      if (labelFolded.includes(folded) || folded.includes(labelFolded) || valueFolded.includes(folded)) {
        return opt.value
      }
      const terms = fieldSearchTerms(opt.value)
      if (terms.some((t) => {
        const tf = foldAz(t)
        return tf.length >= 3 && (folded.includes(tf) || tf.includes(folded))
      })) {
        return opt.value
      }
    }
  }
  return null
}

export function extractProgramIelts(requirements) {
  const score = requirements?.min_language?.ielts ?? requirements?.ielts ?? requirements?.min_ielts
  return score != null && score !== '' ? Number(score) : null
}

export function extractProgramToefl(requirements) {
  const score = requirements?.min_language?.toefl ?? requirements?.toefl ?? requirements?.min_toefl
  return score != null && score !== '' ? Number(score) : null
}

export function countProgramsByCountry(programs = []) {
  const counts = {};
  for (const program of programs) {
    const country = program?.university?.country;
    if (!country) continue;
    counts[country] = (counts[country] || 0) + 1;
  }
  return counts;
}

export function groupProgramsByCountry(programs = [], countryOrder = []) {
  const groups = new Map();
  for (const program of programs) {
    const country = program?.university?.country || 'Digər';
    if (!groups.has(country)) groups.set(country, []);
    groups.get(country).push(program);
  }

  const ordered = [];
  const seen = new Set();
  for (const country of countryOrder) {
    if (!groups.has(country)) continue;
    ordered.push({ country, programs: groups.get(country) });
    seen.add(country);
  }
  for (const [country, countryPrograms] of groups) {
    if (seen.has(country)) continue;
    ordered.push({ country, programs: countryPrograms });
  }
  return ordered;
}

export function buildCountryResultsMeta(programs = [], selectedCountries = []) {
  const countryCounts = countProgramsByCountry(programs);
  const selected = selectedCountries?.length ? selectedCountries : Object.keys(countryCounts);
  const countriesWithResults = selected.filter((country) => (countryCounts[country] || 0) > 0);

  let coverageMessage = null;
  if (selected.length > 1) {
    if (countriesWithResults.length === 0) {
      coverageMessage = `Seçilmiş ${selected.length} ölkədə uyğun proqram tapılmadı.`;
    } else if (countriesWithResults.length < selected.length) {
      coverageMessage = `Seçilmiş ${selected.length} ölkədən yalnız ${countriesWithResults.length} ölkədə uyğun proqram tapıldı.`;
    }
  }

  return {
    countryCounts,
    selectedCountries: selected,
    countriesWithResults,
    coverageMessage,
    groups: groupProgramsByCountry(programs, selected),
  };
}

export const BUDGET_OPTIONS = [
  { value: '0-3000', label: '0 – 3 000 € / il' },
  { value: '3000-8000', label: '3 000 – 8 000 € / il' },
  { value: '8000+', label: '8 000 €+ / il' },
  { value: 'any', label: 'Fərq etmir' },
];

export const DURATION_OPTIONS = [
  { value: 1, label: '1 il' },
  { value: 2, label: '2 il' },
  { value: 3, label: '3 il' },
  { value: 4, label: '4+ il' },
];

export function emptyWizardState() {
  return {
    degreeLevel: '',
    field: '',
    gpa: '',
    languageType: 'ielts',
    languageScore: '',
    countries: [],
    budgetRange: 'any',
    durationYears: '',
  };
}

export function wizardToSearchParams(state) {
  const params = {};
  if (state.degreeLevel) params.degree_level = state.degreeLevel;
  if (state.field) params.field = state.field;
  if (state.gpa !== '') params.min_gpa = state.gpa;
  if (state.countries?.length) params.countries = state.countries.join(',');
  if (state.budgetRange && state.budgetRange !== 'any') {
    const map = { '0-3000': 3000, '3000-8000': 8000, '8000+': null };
    const max = map[state.budgetRange];
    if (max != null) params.max_tuition = max;
  }
  if (state.durationYears) params.duration_years = state.durationYears;
  return params;
}

export function filtersToSearchParams(filters) {
  const params = {};
  if (filters.degree_level) params.degree_level = filters.degree_level;
  const fields = Array.isArray(filters.fields)
    ? filters.fields
    : filters.field
      ? String(filters.field).split(',').map((s) => s.trim()).filter(Boolean)
      : [];
  if (fields.length) params.fields = fields.join(',');
  else if (filters.field) params.field = filters.field;
  if (filters.countries?.length) params.countries = filters.countries.join(',');
  if (filters.scholarship) params.scholarship = 'true';
  if (filters.max_tuition != null && filters.max_tuition !== '') params.max_tuition = filters.max_tuition;
  if (filters.min_gpa != null && filters.min_gpa !== '') params.min_gpa = filters.min_gpa;
  if (filters.language) params.language = filters.language;
  if (filters.max_ranking) params.max_ranking = filters.max_ranking;
  if (filters.no_ielts) params.no_ielts = 'true';
  if (filters.no_motivation) params.no_motivation = 'true';
  if (filters.user_ielts != null && filters.user_ielts !== '') params.user_ielts = filters.user_ielts
  if (filters.user_toefl != null && filters.user_toefl !== '') params.user_toefl = filters.user_toefl
  if (filters.university_type) params.university_type = filters.university_type;
  if (filters.sort) params.sort = filters.sort;
  if (filters.q) params.q = filters.q;
  if (filters.page) params.page = filters.page;
  return params;
}

export function parseWizardFromSearchParams(searchParams) {
  const state = emptyWizardState();
  state.degreeLevel = searchParams.get('degree_level') || '';
  state.field = searchParams.get('field') || '';
  const gpa = searchParams.get('min_gpa');
  state.gpa = gpa ? Number(gpa) : '';
  const countries = searchParams.get('countries');
  state.countries = countries ? countries.split(',').filter(Boolean) : [];
  state.budgetRange = searchParams.get('budget') || 'any';
  return state;
}

export function formatTuition(fee) {
  if (fee == null || Number(fee) === 0) return 'Pulsuz / dövlət';
  return `€${Number(fee).toLocaleString('en-US')}`;
}

export function formatDeadline(dateStr) {
  if (!dateStr) return '—'
  const raw = String(dateStr).trim()
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) {
    const months = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyul', 'avq', 'sen', 'okt', 'noy', 'dek']
    const year = iso[1]
    const month = months[Number(iso[2]) - 1] || iso[2]
    const day = Number(iso[3])
    return `${day} ${month} ${year}`
  }
  try {
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) return raw
    const months = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyul', 'avq', 'sen', 'okt', 'noy', 'dek']
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
  } catch {
    return raw
  }
}

export function universityInitials(name) {
  return String(name || 'U')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}
