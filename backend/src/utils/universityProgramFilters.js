const {
  fieldSearchTerms,
  relatedFieldSlugs,
  fieldMeta,
  FIELD_BY_VALUE,
} = require('../constants/universityFieldCatalog');

const DEGREE_ALIASES = {
  BSc: ['BSc', 'Bachelor', 'Bakalavr', 'BA', 'BS', 'Undergraduate'],
  MSc: ['MSc', 'Master', 'Magistr', 'MA', 'MS', 'MBA', 'Graduate'],
  PhD: ['PhD', 'Ph.D', 'Doctorate', 'Doktorantura', 'Doctor', 'Doctoral'],
};

/** LOWER(degree_level) üçün kanonik tokenlər */
const DEGREE_CANONICAL = {
  BSc: ['bsc', 'bs', 'ba', 'bachelor', 'bakalavr', 'undergraduate'],
  MSc: ['msc', 'ms', 'ma', 'mba', 'master', 'magistr', 'graduate'],
  PhD: ['phd', 'doctorate', 'doctoral', 'doctor', 'doktorantura', 'doktor'],
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

function normalizeFieldSlug(raw) {
  const token = String(raw || '').trim();
  if (!token) return null;
  if (fieldMeta(token)) return token;

  const fromText = resolveFieldFromText(token);
  if (fromText) return fromText;

  const folded = foldAz(token);
  for (const [value, meta] of FIELD_BY_VALUE.entries()) {
    const labelFolded = foldAz(meta.label);
    const valueFolded = foldAz(value.replace(/_/g, ' '));
    if (labelFolded === folded || labelFolded.includes(folded) || folded.includes(labelFolded)) {
      return value;
    }
    if (valueFolded === folded || valueFolded.includes(folded)) return value;
  }
  return token;
}

function normalizeFieldList(values = []) {
  return [...new Set(values.map(normalizeFieldSlug).filter(Boolean))];
}

function collectFieldSlugs(rawQuery = {}, filters = {}) {
  const slugs = new Set(
    normalizeFieldList([
      ...parseArray(rawQuery.fields),
      ...parseArray(rawQuery.field),
      ...parseArray(filters.fields),
      ...parseArray(filters.field),
    ]),
  );

  if (filters.q) {
    const resolved = resolveFieldFromText(filters.q);
    if (resolved) slugs.add(resolved);
  }

  return [...slugs];
}

function fieldPatternsForSlug(slug) {
  const patterns = new Set();
  for (const s of relatedFieldSlugs(slug)) {
    patterns.add(`%${s.replace(/_/g, ' ')}%`);
    patterns.add(`%${s}%`);
  }
  for (const term of fieldSearchTerms(slug)) {
    patterns.add(`%${term}%`);
  }
  const meta = fieldMeta(slug);
  if (meta?.label) {
    patterns.add(`%${meta.label}%`);
    meta.label
      .replace(/\([^)]*\)/g, '')
      .split(/[/,]/)
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((part) => patterns.add(`%${part}%`));
  }
  return [...patterns];
}

function appendFieldsFilter(where, params, fieldSlugs) {
  if (!fieldSlugs?.length) return;

  const allSlugs = new Set();
  const allPatterns = new Set();

  for (const slug of fieldSlugs) {
    const normalized = normalizeFieldSlug(slug);
    if (!normalized) continue;
    relatedFieldSlugs(normalized).forEach((s) => allSlugs.add(s));
    fieldPatternsForSlug(normalized).forEach((p) => allPatterns.add(p));
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
  const canonical = DEGREE_CANONICAL[degreeLevel] || [String(degreeLevel).toLowerCase()];
  const patterns = (DEGREE_ALIASES[degreeLevel] || [degreeLevel]).map((a) => `%${a}%`);
  params.push(canonical);
  const canonIdx = params.length;
  params.push(patterns);
  const patIdx = params.length;
  where.push(`(
    LOWER(REPLACE(p.degree_level, '.', '')) = ANY($${canonIdx}::text[])
    OR EXISTS (
      SELECT 1 FROM unnest($${patIdx}::text[]) pat
      WHERE LOWER(p.degree_level) LIKE LOWER(pat)
    )
  )`);
}

function buildEmptyResultsMessage(filters = {}) {
  const slugs = collectFieldSlugs({}, filters);
  const labels = slugs.map((slug) => fieldMeta(slug)?.label || slug.replace(/_/g, ' '));
  const fieldLabel = labels.length ? labels.join(', ') : 'seçilmiş ixtisas';
  const degree = filters.degreeLevel || '';
  const degreeAz = {
    BSc: 'Bakalavr (BSc)',
    MSc: 'Magistr (MSc)',
    PhD: 'Doktorantura (PhD)',
  }[degree];

  if (degree === 'PhD') {
    return `${fieldLabel} üzrə PhD proqramları hazırda yüklənir. Nümunə üçün "Magistr (MSc)" dərəcəsini seçib yoxlaya bilərsiniz.`;
  }
  if (degree && degreeAz) {
    return `${fieldLabel} üzrə ${degreeAz} proqramları hazırda məhduddur. Filtrləri genişləndirin və ya başqa dərəcə sınayın.`;
  }
  if (slugs.length) {
    return `${fieldLabel} üzrə uyğun proqram hazırda tapılmadı. Ölkə və ya dərəcə filtrini dəyişməyi sınayın.`;
  }
  return 'Uyğun proqram tapılmadı. Filtrləri dəyişdirin.';
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
  const slug = normalizeFieldSlug(fieldSlug);
  if (relatedFieldSlugs(slug).includes(program.field)) return true;

  const patterns = fieldPatternsForSlug(slug).map((p) => p.replace(/%/g, '').toLowerCase());
  const blob = [program.field, program.field_category, program.name, program.university?.name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (program.field === slug) return true;
  return patterns.some((p) => p.length >= 2 && blob.includes(p));
}

function programMatchesDegree(program, degreeLevel) {
  if (!degreeLevel) return true;
  const level = String(program.degree_level || '').toLowerCase().replace(/\./g, '');
  const canonical = DEGREE_CANONICAL[degreeLevel] || [String(degreeLevel).toLowerCase()];
  if (canonical.includes(level)) return true;
  const patterns = (DEGREE_ALIASES[degreeLevel] || [degreeLevel]).map((a) => a.toLowerCase());
  return patterns.some((p) => level.includes(p) || p.includes(level));
}

function programMatchesUserIelts(program, userIelts) {
  if (userIelts == null) return true;
  const req = Number(program.requirements?.min_language?.ielts ?? program.requirements?.min_ielts);
  return !Number.isFinite(req) || req <= userIelts;
}

module.exports = {
  DEGREE_ALIASES,
  DEGREE_CANONICAL,
  parseArray,
  resolveFieldFromText,
  normalizeFieldSlug,
  normalizeFieldList,
  collectFieldSlugs,
  fieldPatternsForSlug,
  appendFieldsFilter,
  appendDegreeFilter,
  appendUserIeltsFilter,
  appendTextSearchFilter,
  programMatchesAnyField,
  programMatchesDegree,
  programMatchesUserIelts,
  buildEmptyResultsMessage,
};
