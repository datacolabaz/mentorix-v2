const {
  fieldSearchTerms,
  relatedFieldSlugs,
} = require('../constants/universityFieldCatalog');

const DEGREE_ALIASES = {
  BSc: ['BSc', 'Bachelor', 'Bakalavr', 'BA', 'BS', 'Undergraduate'],
  MSc: ['MSc', 'Master', 'Magistr', 'MA', 'MS', 'MBA', 'Graduate'],
  PhD: ['PhD', 'Doctorate', 'Doktorantura', 'Doctor', 'Doctoral'],
};

function parseArray(v) {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === 'string' && v.trim()) {
    return v.split(',').map((x) => x.trim()).filter(Boolean);
  }
  return [];
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
    .replace(/ğ/g, 'g');
}

const FIELD_QUERY_ALIASES = [
  { keys: ['computer science', 'kompüter elmləri', 'informatika', ' cs '], value: 'computer_science' },
  { keys: ['data science'], value: 'data_science' },
  { keys: ['artificial intelligence', 'suni intellekt', 'machine learning', ' ai '], value: 'artificial_intelligence' },
  { keys: ['software engineering', 'proqram mühəndisliyi'], value: 'software_engineering' },
  { keys: ['marketing', 'marketinq'], value: 'marketing' },
  { keys: ['business', 'biznes', 'mba'], value: 'business_administration' },
  { keys: ['finance', 'maliyyə'], value: 'finance' },
  { keys: ['chemistry', 'kimya'], value: 'chemistry' },
  { keys: ['medicine', 'tibb'], value: 'medicine' },
];

function resolveFieldFromText(text) {
  const folded = foldAz(text).trim();
  if (!folded || folded.length < 2) return null;

  for (const alias of FIELD_QUERY_ALIASES) {
    if (alias.keys.some((k) => folded.includes(foldAz(k)))) return alias.value;
  }

  const { FIELD_GROUPS } = require('../constants/universityFieldCatalog');
  for (const group of FIELD_GROUPS) {
    for (const opt of group.options) {
      const labelFolded = foldAz(opt.label);
      const valueFolded = foldAz(opt.value.replace(/_/g, ' '));
      if (labelFolded.includes(folded) || folded.includes(labelFolded) || valueFolded.includes(folded)) {
        return opt.value;
      }
      const terms = fieldSearchTerms(opt.value);
      if (terms.some((t) => {
        const tf = foldAz(t);
        return tf.length >= 3 && (folded.includes(tf) || tf.includes(folded));
      })) {
        return opt.value;
      }
    }
  }
  return null;
}

function collectFieldSlugs(rawQuery = {}, filters = {}) {
  const slugs = new Set([
    ...parseArray(rawQuery.fields),
    ...parseArray(rawQuery.field),
    ...parseArray(filters.fields),
    ...parseArray(filters.field),
  ]);

  if (filters.q) {
    const resolved = resolveFieldFromText(filters.q);
    if (resolved) slugs.add(resolved);
  }

  return [...slugs];
}

function degreePatterns(degreeLevel) {
  if (!degreeLevel) return [];
  const aliases = DEGREE_ALIASES[degreeLevel] || [degreeLevel];
  return aliases.map((a) => `%${a}%`);
}

function appendFieldsFilter(where, params, fieldSlugs) {
  if (!fieldSlugs?.length) return;

  const allSlugs = new Set();
  const allPatterns = new Set();

  for (const slug of fieldSlugs) {
    relatedFieldSlugs(slug).forEach((s) => allSlugs.add(s));
    fieldSearchTerms(slug).forEach((t) => allPatterns.add(`%${t}%`));
    allPatterns.add(`%${slug.replace(/_/g, ' ')}%`);
  }

  params.push([...allSlugs]);
  const slugsIdx = params.length;
  params.push([...allPatterns]);
  const patIdx = params.length;

  where.push(`(
    p.field = ANY($${slugsIdx}::text[])
    OR EXISTS (
      SELECT 1 FROM unnest($${patIdx}::text[]) pat
      WHERE p.name ILIKE pat OR p.field ILIKE pat
    )
  )`);
}

function appendDegreeFilter(where, params, degreeLevel) {
  if (!degreeLevel) return;
  const patterns = degreePatterns(degreeLevel);
  params.push(patterns);
  where.push(`p.degree_level ILIKE ANY($${params.length}::text[])`);
}

function appendUserIeltsFilter(where, params, userIelts) {
  if (userIelts == null) return;
  params.push(userIelts);
  const idx = params.length;
  where.push(`(
    p.requirements->'min_language'->>'ielts' IS NULL
    OR TRIM(COALESCE(p.requirements->'min_language'->>'ielts', '')) = ''
    OR (p.requirements->'min_language'->>'ielts')::numeric <= $${idx}
    OR (p.requirements->>'min_ielts')::numeric <= $${idx}
  )`);
}

function appendTextSearchFilter(where, params, q, { skipFieldLike = false } = {}) {
  if (!q) return;
  params.push(`%${q}%`);
  const idx = params.length;
  if (skipFieldLike) {
    where.push(`(p.name ILIKE $${idx} OR u.name ILIKE $${idx} OR u.city ILIKE $${idx})`);
  } else {
    where.push(`(p.name ILIKE $${idx} OR u.name ILIKE $${idx} OR u.city ILIKE $${idx} OR p.field ILIKE $${idx})`);
  }
}

function programMatchesAnyField(program, fieldSlugs) {
  if (!fieldSlugs?.length) return true;
  return fieldSlugs.some((slug) => programMatchesSingleField(program, slug));
}

function programMatchesSingleField(program, fieldSlug) {
  if (!fieldSlug) return true;
  if (relatedFieldSlugs(fieldSlug).includes(program.field)) return true;

  const terms = fieldSearchTerms(fieldSlug);
  const blob = [program.field, program.field_category, program.name, program.university?.name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (program.field === fieldSlug) return true;
  return terms.some((t) => blob.includes(String(t).toLowerCase()));
}

function programMatchesDegree(program, degreeLevel) {
  if (!degreeLevel) return true;
  const level = String(program.degree_level || '').toLowerCase();
  const patterns = (DEGREE_ALIASES[degreeLevel] || [degreeLevel]).map((a) => a.toLowerCase());
  return patterns.some((p) => level.includes(p.toLowerCase()) || p.toLowerCase().includes(level));
}

function programMatchesUserIelts(program, userIelts) {
  if (userIelts == null) return true;
  const req = Number(program.requirements?.min_language?.ielts ?? program.requirements?.min_ielts);
  return !Number.isFinite(req) || req <= userIelts;
}

module.exports = {
  DEGREE_ALIASES,
  parseArray,
  resolveFieldFromText,
  collectFieldSlugs,
  appendFieldsFilter,
  appendDegreeFilter,
  appendUserIeltsFilter,
  appendTextSearchFilter,
  programMatchesAnyField,
  programMatchesDegree,
  programMatchesUserIelts,
};
