const { fieldSearchTerms, flatFieldOptions } = require('../constants/universityFieldCatalog');
const { filterCountriesByQuery } = require('../constants/universityCountries');
const { searchPrograms, normalizeFilters } = require('./universityProgramService');

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
    .replace(/ğ/g, 'g');
}

const FIELD_ALIASES = [
  { keys: ['computer science', 'kompüter elmləri', 'informatika', 'cs'], value: 'computer_science' },
  { keys: ['data science'], value: 'data_science' },
  { keys: ['artificial intelligence', 'suni intellekt', 'machine learning', ' ai '], value: 'artificial_intelligence' },
  { keys: ['software engineering', 'proqram mühəndisliyi'], value: 'software_engineering' },
  { keys: ['business', 'biznes', 'mba'], value: 'business_administration' },
  { keys: ['finance', 'maliyyə'], value: 'finance' },
  { keys: ['chemistry', 'kimya'], value: 'chemistry' },
  { keys: ['medicine', 'tibb'], value: 'medicine' },
];

function resolveFieldFromText(text) {
  const folded = foldAz(text);
  for (const alias of FIELD_ALIASES) {
    if (alias.keys.some((k) => folded.includes(foldAz(k)))) return alias.value;
  }
  for (const opt of flatFieldOptions()) {
    const label = foldAz(opt.label);
    const value = foldAz(String(opt.value).replace(/_/g, ' '));
    if (label.includes(folded) || folded.includes(label) || value.includes(folded)) return opt.value;
    const terms = fieldSearchTerms(opt.value);
    if (terms.some((t) => {
      const tf = foldAz(t);
      return tf.length >= 3 && folded.includes(tf);
    })) {
      return opt.value;
    }
  }
  return null;
}

function parseGpaFromText(text) {
  const folded = foldAz(text);
  const gpa100 = folded.match(/gpa\s*[:=]?\s*(\d{2,3})/);
  if (gpa100) {
    const n = Number(gpa100[1]);
    if (n > 4.5) return Math.round((n / 25) * 100) / 100;
    return n;
  }
  const gpa4 = folded.match(/gpa\s*[:=]?\s*(\d(?:\.\d)?)/);
  if (gpa4) return Number(gpa4[1]);
  return null;
}

function parseUniversityAiQuery(query) {
  const text = String(query || '').trim();
  const folded = foldAz(text);
  const filters = {};
  const summary = [];

  if (/magistr|msc|master/.test(folded)) {
    filters.degreeLevel = 'MSc';
    summary.push('Dərəcə: Magistr (MSc)');
  } else if (/bakalavr|bsc|undergraduate/.test(folded)) {
    filters.degreeLevel = 'BSc';
    summary.push('Dərəcə: Bakalavr (BSc)');
  } else if (/phd|doktorantura|doctorate/.test(folded)) {
    filters.degreeLevel = 'PhD';
    summary.push('Dərəcə: Doktorantura (PhD)');
  }

  const field = resolveFieldFromText(text);
  if (field) {
    filters.field = field;
    const label = flatFieldOptions().find((o) => o.value === field)?.label || field;
    summary.push(`İxtisas: ${label}`);
  }

  const ielts = folded.match(/ielts\s*[:=]?\s*(\d(?:\.\d)?)/);
  if (ielts) {
    filters.userIelts = Number(ielts[1]);
    summary.push(`Sizin IELTS: ${ielts[1]} (tələb olunan bal bundan aşağı olan proqramlar)`);
  }

  const gpa = parseGpaFromText(text);
  if (gpa != null) {
    filters.minGpa = gpa;
    summary.push(`GPA: ${gpa}`);
  }

  const budget = folded.match(/(\d{3,5})\s*(euro|eur|€|avro)/);
  if (budget) {
    filters.maxTuition = Number(budget[1]);
    summary.push(`Büdcə: max €${budget[1]} / il`);
  }

  if (/təqaüd|teqaud|scholarship|stipend/.test(folded)) {
    filters.scholarship = true;
    summary.push('Yalnız təqaüdlü proqramlar');
  }

  if (/ingilis|english/.test(folded)) {
    filters.language = 'English';
    summary.push('Dil: İngilis');
  }

  if (/qs\s*top\s*(\d{2,4})|top\s*(\d{2,4})\s*qs|reytinq\s*(\d{2,4})/.test(folded)) {
    const m = folded.match(/qs\s*top\s*(\d{2,4})|top\s*(\d{2,4})\s*qs|reytinq\s*(\d{2,4})/);
    const rank = Number(m[1] || m[2] || m[3]);
    if (Number.isFinite(rank)) {
      filters.maxRanking = rank;
      summary.push(`QS / dünya reytinqi: top ${rank}`);
    }
  } else if (/top\s*500|qs\s*500/.test(folded)) {
    filters.maxRanking = 500;
    summary.push('QS top 500');
  }

  if (/ielts\s*tələb\s*etmir|ielts\s*olmadan|no\s*ielts/.test(folded)) {
    filters.noIelts = true;
    summary.push('IELTS tələb etmir');
  }

  if (/motivasiya\s*məktubu\s*olmadan|motivation\s*letter\s*yox/.test(folded)) {
    filters.noMotivation = true;
    summary.push('Motivasiya məktubu tələb etmir');
  }

  for (const country of filterCountriesByQuery(text)) {
    if (folded.includes(foldAz(country))) {
      filters.countries = [...(filters.countries || []), country];
    }
  }
  if (filters.countries?.length) {
    summary.push(`Ölkələr: ${filters.countries.join(', ')}`);
  }

  const uniMatch = text.match(/(?:universitet|university|in)\s+([A-Za-zÀ-ÿ\s.'-]{3,})/i);
  if (!field && uniMatch) {
    filters.q = uniMatch[1].trim().slice(0, 80);
    summary.push(`Universitet axtarışı: "${filters.q}"`);
  }

  return { filters, summary, query: text };
}

async function runUniversityProgramAiSearch({ query, limit = 24 } = {}) {
  const parsed = parseUniversityAiQuery(query);
  if (!Object.keys(parsed.filters).length) {
    const err = new Error('Sorğunu başa düşmədik. GPA, IELTS, büdcə, ixtisas və ya ölkə qeyd edin.');
    err.statusCode = 400;
    throw err;
  }

  const searchFilters = normalizeFilters({
    degree_level: parsed.filters.degreeLevel,
    fields: parsed.filters.fields || (parsed.filters.field ? [parsed.filters.field] : undefined),
    field: parsed.filters.fields?.[0] || parsed.filters.field,
    countries: parsed.filters.countries,
    scholarship: parsed.filters.scholarship,
    max_tuition: parsed.filters.maxTuition,
    min_gpa: parsed.filters.minGpa,
    language: parsed.filters.language,
    max_ranking: parsed.filters.maxRanking,
    no_ielts: parsed.filters.noIelts,
    no_motivation: parsed.filters.noMotivation,
    user_ielts: parsed.filters.userIelts,
    q: parsed.filters.q,
    limit,
    page: 1,
  });

  const result = await searchPrograms(searchFilters);
  const programs = result.data || result.programs || [];

  return {
    query: parsed.query,
    interpreted_filters: parsed.filters,
    summary: parsed.summary,
    count: result.count || programs.length,
    programs: programs.slice(0, limit),
    pagination: result.pagination,
    source: result.source,
  };
}

module.exports = {
  parseUniversityAiQuery,
  runUniversityProgramAiSearch,
};
