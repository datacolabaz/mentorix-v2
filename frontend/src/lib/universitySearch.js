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
  const score = requirements?.min_language?.ielts
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
 