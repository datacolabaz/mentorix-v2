const fs = require('fs');
const path = require('path');
const db = require('../utils/db');
const { UNIVERSITY_COUNTRIES } = require('../constants/universityCountries');

const AMERICA_CANADA_COUNTRIES = ['Amerika Birləşmiş Ştatları', 'Kanada'];

const EUROPE_COUNTRIES = UNIVERSITY_COUNTRIES.filter(
  (c) => !AMERICA_CANADA_COUNTRIES.includes(c),
);

function loadApplyLinks(file = null) {
  const dataPath = file || path.join(__dirname, '../../data/europe_apply_links.json');
  const raw = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  return raw.universities || [];
}

async function updateEuropeApplyLinks({ file = null, dryRun = false } = {}) {
  const universities = loadApplyLinks(file);
  const stats = {
    source: file || path.join(__dirname, '../../data/europe_apply_links.json'),
    universities_total: universities.length,
    universities_updated: 0,
    programs_bsc_updated: 0,
    programs_grad_updated: 0,
    skipped: [],
    errors: [],
  };

  for (const entry of universities) {
    const name = String(entry.name || '').trim();
    const undergrad = String(entry.undergrad_apply_link || '').trim() || null;
    const graduate = String(entry.graduate_apply_link || '').trim() || null;

    if (!name || (!undergrad && !graduate)) {
      stats.skipped.push({ name, reason: 'missing links' });
      continue;
    }

    try {
      if (dryRun) {
        stats.universities_updated += 1;
        stats.programs_bsc_updated += 4;
        stats.programs_grad_updated += 8;
        continue;
      }

      console.log(`[update:europe-apply-links] ${stats.universities_updated + 1}/${universities.length} — ${name}`);

      const { rows: matches } = await db.query(
        `
        SELECT id, country
        FROM universities
        WHERE name = $1
          AND country = ANY($2::text[])
        `,
        [name, EUROPE_COUNTRIES],
      );

      if (!matches.length) {
        stats.skipped.push({ name, reason: 'university not found in Europe countries' });
        continue;
      }

      if (matches.length > 1) {
        stats.skipped.push({ name, reason: `ambiguous: ${matches.length} rows` });
        continue;
      }

      const uniId = matches[0].id;

      await db.query(
        `
        UPDATE universities
        SET
          undergrad_apply_link = COALESCE($2, undergrad_apply_link),
          graduate_apply_link = COALESCE($3, graduate_apply_link)
        WHERE id = $1
        `,
        [uniId, undergrad, graduate],
      );

      stats.universities_updated += 1;

      if (undergrad) {
        const { rowCount } = await db.query(
          `
          UPDATE programs
          SET apply_link = $1::text, updated_at = NOW()
          WHERE uni_id = $2 AND degree_level = 'BSc'
          `,
          [undergrad, uniId],
        );
        stats.programs_bsc_updated += rowCount;
      }

      if (graduate) {
        const { rowCount } = await db.query(
          `
          UPDATE programs
          SET apply_link = $1::text, updated_at = NOW()
          WHERE uni_id = $2 AND degree_level IN ('MSc', 'PhD')
          `,
          [graduate, uniId],
        );
        stats.programs_grad_updated += rowCount;
      }
    } catch (err) {
      stats.errors.push({ name, message: err?.message || String(err) });
    }
  }

  return stats;
}

module.exports = {
  loadApplyLinks,
  updateEuropeApplyLinks,
  EUROPE_COUNTRIES,
};
