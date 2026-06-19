const fs = require('fs');
const path = require('path');
const db = require('../utils/db');
const { upsertUniversity, normalizeDegree } = require('./universityProgramIngestService');
const { resolveFieldSlug } = require('../utils/fieldSlugNormalizer');
const { parseCsv, normalizeCountryName } = require('../utils/universityProgramImportParsers');

const COUNTRY_DB_CANONICAL = {
  Hollandiya: 'Niderlandiya',
};

function canonicalCountry(raw) {
  const normalized =
    normalizeCountryName(raw) ||
    String(raw || '').trim();
  return COUNTRY_DB_CANONICAL[normalized] || normalized;
}

async function harmonizeCountryNames() {
  for (const [from, to] of Object.entries(COUNTRY_DB_CANONICAL)) {
    await db.query('UPDATE universities SET country = $1 WHERE country = $2', [to, from]);
  }
}

function parseDegrees(raw) {
  return String(raw || 'BSc/MSc/PhD')
    .split(/[/,|]/)
    .map((d) => normalizeDegree(d.trim()))
    .filter((d) => ['BSc', 'MSc', 'PhD'].includes(d));
}

function parseFields(raw) {
  return String(raw || '')
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean);
}

function parseIelts(raw) {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizeFieldFromLabel(label) {
  const token = String(label || '').trim();
  if (!token) return 'general_studies';
  const { slug } = resolveFieldSlug(token);
  return slug;
}

function loadJsonRecords(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const rows = [];
  for (const block of raw.countries || []) {
    const countryAz = block.country || block.country_az;
    const countryEn = block.country_en;
    for (const uni of block.universities || []) {
      rows.push({
        country_az: countryAz,
        country_en: countryEn,
        university_name: uni.name,
        city: uni.city,
        qs_rank_2025: uni.qs_rank_2025 ?? uni.world_ranking,
        degree_types: (uni.degrees || ['BSc', 'MSc', 'PhD']).join('/'),
        language: uni.language,
        ielts_min: uni.ielts_min,
        apply_link: uni.apply_link,
        programs_link: uni.programs_link,
        fields: (uni.fields || []).join(', '),
      });
    }
  }
  return rows;
}

function loadCsvRecords(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  return parseCsv(text);
}

async function insertProgramIfAbsent({
  uni_id,
  payload,
  source_type = 'seed',
  review_status = 'approved',
}) {
  const name = String(payload.name || '').trim();
  const degree_level = normalizeDegree(payload.degree_level);
  const field = normalizeFieldFromLabel(payload.field || payload.field_hint || name);
  const requirements = payload.requirements && typeof payload.requirements === 'object'
    ? payload.requirements
    : {};

  const { rowCount } = await db.query(
    `
    INSERT INTO programs (
      uni_id, degree_level, name, field, language, requirements,
      apply_link, portal_source, source_type, review_status, is_active, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, true, NOW())
    ON CONFLICT (uni_id, name, degree_level) DO NOTHING
    `,
    [
      uni_id,
      degree_level,
      name,
      field,
      payload.language || 'English',
      JSON.stringify(requirements),
      payload.apply_link || null,
      'seed',
      source_type,
      review_status,
    ],
  );

  return { inserted: rowCount > 0 };
}

function buildProgramRows(row) {
  const fields = parseFields(row.fields);
  const degrees = parseDegrees(row.degree_types || row.degrees);
  const ielts = parseIelts(row.ielts_min);
  const applyLink = row.apply_link || null;
  const language = row.language || 'English';
  const programs = [];

  for (const fieldLabel of fields) {
    const fieldSlug = normalizeFieldFromLabel(fieldLabel);
    for (const degree of degrees) {
      programs.push({
        name: `${fieldLabel} (${degree})`,
        degree_level: degree,
        field: fieldSlug,
        field_hint: fieldSlug,
        language,
        apply_link: applyLink,
        requirements: ielts ? { min_language: { ielts } } : {},
      });
    }
  }
  return programs;
}

async function importEuropeUniversities({
  file = null,
  format = 'auto',
  dryRun = false,
  limit = null,
} = {}) {
  const dataDir = path.join(__dirname, '../../data');
  const jsonPath = file && file.endsWith('.json') ? file : path.join(dataDir, 'europe_universities.json');
  const csvPath = file && file.endsWith('.csv') ? file : path.join(dataDir, 'europe_universities.csv');

  let rows = [];
  const sourceFile = file || (fs.existsSync(jsonPath) ? jsonPath : csvPath);
  const ext = path.extname(sourceFile).toLowerCase();

  if (format === 'json' || ext === '.json') {
    rows = loadJsonRecords(sourceFile);
  } else {
    rows = loadCsvRecords(sourceFile);
  }

  if (limit != null && Number.isFinite(Number(limit))) {
    rows = rows.slice(0, Number(limit));
  }

  if (!dryRun) {
    await harmonizeCountryNames();
  }

  const stats = {
    source: sourceFile,
    universities_total: rows.length,
    universities_inserted: 0,
    universities_updated: 0,
    programs_inserted: 0,
    programs_skipped: 0,
    programs_updated: 0,
    errors: [],
  };

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    try {
      const country = canonicalCountry(row.country_az || row.country_en || row.country);
      const uniName = String(row.university_name || row.name || '').trim();
      if (!uniName || !country) continue;

      if (!dryRun && (i === 0 || (i + 1) % 5 === 0 || i + 1 === rows.length)) {
        console.log(`[import:europe] ${i + 1}/${rows.length} — ${uniName}`);
      }

      const uniPayload = {
        name: uniName,
        country,
        city: row.city || null,
        world_ranking: row.qs_rank_2025 != null ? Number(row.qs_rank_2025) : null,
        funding_info: row.tuition_note || null,
      };

      if (dryRun) {
        stats.universities_inserted += 1;
        stats.programs_inserted += buildProgramRows(row).length;
        continue;
      }

      const uni = await upsertUniversity(uniPayload);
      stats.universities_inserted += 1;

      for (const program of buildProgramRows(row)) {
        const result = await insertProgramIfAbsent({
          uni_id: uni.id,
          payload: program,
        });
        if (result.inserted) stats.programs_inserted += 1;
        else stats.programs_skipped += 1;
      }
    } catch (err) {
      stats.errors.push({
        university: row.university_name || row.name,
        message: err?.message || String(err),
      });
    }
  }

  return stats;
}

module.exports = {
  importEuropeUniversities,
  buildProgramRows,
  loadJsonRecords,
  loadCsvRecords,
  harmonizeCountryNames,
};
