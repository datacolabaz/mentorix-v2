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

export const MVP_COUNTRIES = ['Almaniya', 'Polşa', 'Türkiyə', 'Macarıstan', 'İtaliya'];

export const FIELD_OPTIONS = [
  { value: 'CS', label: 'Kompüter Elmləri' },
  { value: 'Business', label: 'Biznes / İdarəetmə' },
  { value: 'Engineering', label: 'Mühəndislik' },
  { value: 'Life Sciences', label: 'Həyat Elmləri' },
];

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
  if (filters.field) params.field = filters.field;
  if (filters.countries?.length) params.countries = filters.countries.join(',');
  if (filters.scholarship) params.scholarship = 'true';
  if (filters.max_tuition != null) params.max_tuition = filters.max_tuition;
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
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('az-AZ', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
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
