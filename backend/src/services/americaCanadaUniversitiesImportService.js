const fs = require('fs');
const path = require('path');
const db = require('../utils/db');
const { upsertUniversity, normalizeDegree } = require('./universityProgramIngestService');
const { resolveFieldSlug } = require('../utils/fieldSlugNormalizer');
const { parseCsv } = require('../utils/universityProgramImportParsers');
const { resolveApplyLinkForDegree } = require('../utils/programApplyLink');
const { loadApplyLinks } = require('./usaCanadaApplyLinksService');

const COUNTRY_DB_CANONICAL = {
  ABŞ: 'Amerika Birləşmiş Ştatları',
  'United States': 'Amerika Birləşmiş Ştatları',
};

function canonicalCountry(raw) {
  const token = String(raw || '').trim();
  return COUNTRY_DB_CANONICAL[token] || token;
}

function normalizeUniversityType(raw) {
  const token = String(raw || '').trim();
  if (!token) return null;
  if (/^public$/i.test(token)) return 'Public';
  return 'Private';
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

function parseScore(raw) {
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
    for (const uni of block.universities || []) {
      rows.push({
        country_az: countryAz,
        country_en: block.country_en,
        university_name: uni.name,
        city: uni.city,
        qs_rank_2025: uni.qs_rank_2025 ?? uni.world_ranking,
        type: uni.type,
        degree_types: (uni.degrees || ['BSc', 'MSc', 'PhD']).join('/'),
        language: uni.language,
        ielts_min: uni.ielts_min,
        toefl_min: uni.toefl_min,
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

async function insertProgramIfAbsent({ uni_id, payload }) {
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
      'seed',
      'approved',
    ],
  );

  return { inserted: rowCount > 0 };
}

function buildLanguageRequirements(ielts, toefl) {
  const lang = {};
  if (ielts != null) lang.ielts = ielts;
  if (toefl != null) lang.toefl = toefl;
  return Object.keys(lang).length ? { min_language: lang } : {};
}

function buildProgramRows(row) {
  const fields = parseFields(row.fields);
  const degrees = parseDegrees(row.degree_types || row.degrees);
  const ielts = parseScore(row.ielts_min);
  const toefl = parseScore(row.toefl_min);
  const language = row.language || 'English';
  const requirements = buildLanguageRequirements(ielts, toefl);
  const linkContext = {
    undergrad_apply_link: row.undergrad_apply_link,
    graduate_apply_link: row.graduate_apply_link,
    apply_link: row.apply_link,
  };
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
        apply_link: resolveApplyLinkForDegree(degree, linkContext),
        requirements,
      });
    }
  }
  return programs;
}

function enrichRowsWithApplyLinks(rows, applyLinksByName) {
  return rows.map((row) => {
    const uniName = String(row.university_name || row.name || '').trim();
    const links = applyLinksByName.get(uniName);
    if (!links) return row;
    return {
      ...row,
      undergrad_apply_link: links.undergrad_apply_link,
      graduate_apply_link: links.graduate_apply_link,
    };
  });
}

function buildApplyLinksMap(entries = []) {
  const map = new Map();
  for (const entry of entries) {
    const name = String(entry.name || '').trim();
    if (!name) continue;
    map.set(name, {
      undergrad_apply_link: entry.undergrad_apply_link || null,
      graduate_apply_link: entry.graduate_apply_link || null,
    });
  }
  return map;
}

async function importAmericaCanadaUniversities({
  file = null,
  dryRun = false,
  limit = null,
} = {}) {
  const dataDir = path.join(__dirname, '../../data');
  const jsonPath = file && file.endsWith('.json') ? file : path.join(dataDir, 'america_canada_universities.json');
  const csvPath = file && file.endsWith('.csv') ? file : path.join(dataDir, 'america_canada_universities.csv');

  const sourceFile = file || (fs.existsSync(jsonPath) ? jsonPath : csvPath);
  const ext = path.extname(sourceFile).toLowerCase();
  let rows = ext === '.json' ? loadJsonRecords(sourceFile) : loadCsvRecords(sourceFile);

  const applyLinksPath = path.join(dataDir, 'usa_canada_apply_links.json');
  if (fs.existsSync(applyLinksPath)) {
    rows = enrichRowsWithApplyLinks(rows, buildApplyLinksMap(loadApplyLinks(applyLinksPath)));
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
    programs_inserted: 0,
    programs_skipped: 0,
    errors: [],
  };

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    try {
      const country = canonicalCountry(row.country_az || row.country_en || row.country);
      const uniName = String(row.university_name || row.name || '').trim();
      if (!uniName || !country) continue;

      if (!dryRun && (i === 0 || (i + 1) % 5 === 0 || i + 1 === rows.length)) {
        console.log(`[import:america] ${i + 1}/${rows.length} — ${uniName}`);
      }

      const uniPayload = {
        name: uniName,
        country,
        city: row.city || null,
        world_ranking: row.qs_rank_2025 != null ? Number(row.qs_rank_2025) : null,
        university_type: normalizeUniversityType(row.type),
        undergrad_apply_link: row.undergrad_apply_link || null,
        graduate_apply_link: row.graduate_apply_link || null,
      };

      if (dryRun) {
        stats.universities_inserted += 1;
        stats.programs_inserted += buildProgramRows(row).length;
        continue;
      }

      const uni = await upsertUniversity(uniPayload);
      stats.universities_inserted += 1;

      for (const program of buildProgramRows(row)) {
        const result = await insertProgramIfAbsent({ uni_id: uni.id, payload: program });
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
  importAmericaCanadaUniversities,
  buildProgramRows,
  normalizeUniversityType,
  buildLanguageRequirements,
};
