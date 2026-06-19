const { COUNTRY_SEARCH_ALIASES } = require('../constants/universityCountries');

/** Ingilis/ümumi ölkə adlarını AZ etiketinə (mümkünsə) */
const COUNTRY_EN_TO_AZ = {};
for (const [az, aliases] of Object.entries(COUNTRY_SEARCH_ALIASES)) {
  COUNTRY_EN_TO_AZ[az.toLowerCase()] = az;
  for (const alias of aliases) {
    COUNTRY_EN_TO_AZ[alias.toLowerCase()] = az;
  }
}

const EXTRA_COUNTRY_MAP = {
  usa: 'ABŞ',
  'united states': 'ABŞ',
  'united states of america': 'ABŞ',
  uk: 'Böyük Britaniya',
  'united kingdom': 'Böyük Britaniya',
  england: 'Böyük Britaniya',
  canada: 'Kanada',
  australia: 'Avstraliya',
  china: 'Çin',
  japan: 'Yaponiya',
  'south korea': 'Cənubi Koreya',
  korea: 'Cənubi Koreya',
  india: 'Hindistan',
  singapore: 'Sinqapur',
  switzerland: 'İsveçrə',
  netherlands: 'Niderlandiya',
  holland: 'Niderlandiya',
  'new zealand': 'Yeni Zelandiya',
  brazil: 'Braziliya',
  mexico: 'Meksika',
  russia: 'Rusiya',
  ukraine: 'Ukrayna',
  georgia: 'Gürcüstan',
  azerbaijan: 'Azərbaycan',
};

function fold(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function normalizeCountryName(raw) {
  const key = fold(raw);
  if (!key) return 'Naməlum';
  return COUNTRY_EN_TO_AZ[key] || EXTRA_COUNTRY_MAP[key] || String(raw).trim();
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseCsv(text) {
  const lines = String(text || '').split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const vals = parseCsvLine(line);
    const row = {};
    headers.forEach((h, i) => {
      row[h] = vals[i] != null ? vals[i].trim() : '';
    });
    return row;
  });
}

function pick(row, keys) {
  for (const key of keys) {
    if (row[key] != null && String(row[key]).trim() !== '') return row[key];
    const found = Object.keys(row).find((k) => k.toLowerCase() === key.toLowerCase());
    if (found && String(row[found]).trim() !== '') return row[found];
  }
  return null;
}

function parseNumber(v) {
  if (v == null || String(v).trim() === '') return null;
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function parseDeadline(v) {
  if (!v) return [];
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return [s.slice(0, 10)];
  return [];
}

function mapGenericRecord(row) {
  const university_name = pick(row, [
    'university_name', 'university', 'University', 'institution', 'uni_name',
  ]);
  const program_name = pick(row, [
    'program_name', 'program', 'Program', 'name', 'course', 'title',
  ]);
  if (!university_name || !program_name) return null;

  const fieldRaw = pick(row, ['field', 'field_of_study', 'field_raw', 'Program', 'major', 'subject']) || program_name;
  const ielts = parseNumber(pick(row, ['ielts', 'ielts_score', 'min_ielts', 'IELTS']));
  const requirements = {};
  if (ielts != null && ielts > 0) requirements.min_language = { ielts };

  const gpa = parseNumber(pick(row, ['gpa', 'min_gpa']));
  if (gpa != null && gpa > 0) requirements.min_gpa = gpa;

  return {
    university_name: String(university_name).trim(),
    country: normalizeCountryName(pick(row, ['country', 'Country', 'nation'])),
    city: pick(row, ['city', 'City', 'location']) || null,
    world_ranking: parseNumber(pick(row, ['qs_ranking', 'world_ranking', 'ranking', 'qs_rank'])),
    program_name: String(program_name).trim(),
    degree_level: pick(row, ['degree_level', 'degree', 'Level', 'level', 'degree_type']),
    field_raw: fieldRaw,
    duration_years: parseNumber(pick(row, ['duration_years', 'duration', 'Duration_Years'])),
    tuition_fee: parseNumber(pick(row, ['tuition_fee', 'tuition', 'Tuition_USD', 'tuition_usd', 'fee'])),
    scholarship_available: ['true', '1', 'yes', 'y'].includes(
      String(pick(row, ['scholarship_available', 'has_scholarship', 'scholarship']) || '').toLowerCase(),
    ),
    language: pick(row, ['language', 'Language']) || 'English',
    deadline_dates: parseDeadline(pick(row, ['deadline', 'application_deadline', 'deadline_date'])),
    apply_link: pick(row, ['apply_url', 'apply_link', 'url', 'website', 'link']),
    requirements,
    import_source: pick(row, ['source', 'import_source']) || 'generic',
  };
}

function mapStudyAbroadRow(row) {
  return mapGenericRecord({
    University: row.University,
    Country: row.Country,
    City: row.City,
    Program: row.Program,
    Level: row.Level,
    Duration_Years: row.Duration_Years,
    Tuition_USD: row.Tuition_USD,
    import_source: 'study_abroad',
  });
}

function normalizeRecords({ rows, format = 'auto' } = {}) {
  const fmt = format === 'auto'
    ? (rows[0]?.University && rows[0]?.Program ? 'study_abroad' : 'generic')
    : format;

  const mapper = fmt === 'study_abroad' ? mapStudyAbroadRow : mapGenericRecord;
  return rows.map(mapper).filter(Boolean);
}

function parseJsonRecords(text) {
  const data = JSON.parse(text);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.programs)) return data.programs;
  if (Array.isArray(data.data)) return data.data;
  throw new Error('JSON massiv tapılmadı (programs[] və ya data[] gözlənilir)');
}

const PRESETS = {
  study_abroad: {
    label: 'Study Abroad (GitHub ~900 proqram)',
    url: 'https://raw.githubusercontent.com/AdilShamim8/Study_Abroad/main/International_Education_Costs.csv',
    format: 'study_abroad',
  },
};

module.exports = {
  PRESETS,
  parseCsv,
  parseJsonRecords,
  normalizeRecords,
  normalizeCountryName,
  mapGenericRecord,
  mapStudyAbroadRow,
};
