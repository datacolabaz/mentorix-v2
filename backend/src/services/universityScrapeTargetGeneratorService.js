const db = require('../utils/db');
const { allFieldValues } = require('../constants/universityFieldCatalog');
const { primaryEnglishFieldLabel } = require('../utils/fieldSlugNormalizer');

const DEGREE_TYPES = ['BSc', 'MSc', 'PhD'];
const DEGREE_PORTAL_KEY = {
  BSc: 'bachelor',
  MSc: 'master',
  PhD: 'phd',
};

function buildMastersportalSearchUrl(fieldSlug, degreeType) {
  const q = primaryEnglishFieldLabel(fieldSlug);
  const d = DEGREE_PORTAL_KEY[degreeType];
  return `https://www.mastersportal.eu/search/#q=${encodeURIComponent(q)}|d=${d}`;
}

function catalogTargetLabel(fieldSlug, degreeType) {
  return `${fieldSlug} / ${degreeType}`;
}

async function countScrapeTargets() {
  const { rows } = await db.query(`SELECT COUNT(*)::int AS total FROM university_scrape_targets`);
  return rows[0]?.total || 0;
}

async function ensureScrapeTargets({ minTargets = 50 } = {}) {
  const existing = await countScrapeTargets();
  if (existing >= minTargets) {
    return { skipped: true, existing, inserted: 0 };
  }

  const fields = allFieldValues();
  let inserted = 0;
  let skipped = 0;

  for (const fieldSlug of fields) {
    for (const degreeType of DEGREE_TYPES) {
      const admission_url = buildMastersportalSearchUrl(fieldSlug, degreeType);
      const university_name = catalogTargetLabel(fieldSlug, degreeType);
      const country = 'Catalog';

      try {
        // eslint-disable-next-line no-await-in-loop
        const { rows } = await db.query(
          `
          INSERT INTO university_scrape_targets (
            university_name, country, admission_url,
            degree_hint, field_hint, field_slug, degree_type,
            source_type, target_type, is_active
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'mastersportal', 'catalog', true)
          ON CONFLICT (admission_url) DO NOTHING
          RETURNING id
          `,
          [
            university_name,
            country,
            admission_url,
            degreeType,
            fieldSlug,
            fieldSlug,
            degreeType,
          ],
        );

        if (rows.length) inserted += 1;
        else skipped += 1;
      } catch (err) {
        if (err?.code === '23505') skipped += 1;
        else throw err;
      }
    }
  }

  const total = await countScrapeTargets();
  return { skipped: false, existing, inserted, skipped_duplicates: skipped, total };
}

module.exports = {
  DEGREE_TYPES,
  DEGREE_PORTAL_KEY,
  buildMastersportalSearchUrl,
  countScrapeTargets,
  ensureScrapeTargets,
};
