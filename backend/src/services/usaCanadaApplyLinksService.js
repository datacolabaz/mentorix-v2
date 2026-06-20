const fs = require('fs');
const path = require('path');
const db = require('../utils/db');
const { resolveApplyLinkForDegree } = require('../utils/programApplyLink');

const AMERICA_CANADA_COUNTRIES = ['Amerika Birləşmiş Ştatları', 'Kanada'];

function loadApplyLinks(file = null) {
  const dataPath = file || path.join(__dirname, '../../data/usa_canada_apply_links.json');
  const raw = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  return raw.universities || [];
}

async function updateUsaCanadaApplyLinks({ file = null, dryRun = false } = {}) {
  const universities = loadApplyLinks(file);
  const stats = {
    source: file || path.join(__dirname, '../../data/usa_canada_apply_links.json'),
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

      console.log(`[update:america-apply-links] ${stats.universities_updated + 1}/${universities.length} — ${name}`);

      const { rows: uniRows } = await db.query(
        `
        UPDATE universities
        SET
          undergrad_apply_link = COALESCE($2, undergrad_apply_link),
          graduate_apply_link = COALESCE($3, graduate_apply_link)
        WHERE name = $1
          AND country = ANY($4::text[])
        RETURNING id
        `,
        [name, undergrad, graduate, AMERICA_CANADA_COUNTRIES],
      );

      if (!uniRows.length) {
        stats.skipped.push({ name, reason: 'university not found in US/Canada' });
        continue;
      }

      stats.universities_updated += 1;
      const uniId = uniRows[0].id;

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

function applyLinkForProgramRow(row, degreeLevel) {
  return resolveApplyLinkForDegree(degreeLevel, {
    undergrad_apply_link: row.undergrad_apply_link,
    graduate_apply_link: row.graduate_apply_link,
    apply_link: row.apply_link,
  });
}

module.exports = {
  loadApplyLinks,
  updateUsaCanadaApplyLinks,
  applyLinkForProgramRow,
  AMERICA_CANADA_COUNTRIES,
};
