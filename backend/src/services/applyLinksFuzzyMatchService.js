const db = require('../utils/db');
const { loadApplyLinks, EUROPE_COUNTRIES } = require('./europeApplyLinksService');
const { findMatchingUniversities, findOrphanNameVariants, buildSearchPatterns } = require('../utils/applyLinkNameMatcher');

async function applyLinksToUniversity(uniId, { undergrad, graduate, dryRun = false }) {
  const result = {
    programs_bsc_updated: 0,
    programs_grad_updated: 0,
  };

  if (dryRun) {
    const { rows } = await db.query(
      `
      SELECT
        COUNT(*) FILTER (WHERE degree_level = 'BSc')::int AS bsc,
        COUNT(*) FILTER (WHERE degree_level IN ('MSc', 'PhD'))::int AS grad
      FROM programs
      WHERE uni_id = $1
      `,
      [uniId],
    );
    result.programs_bsc_updated = undergrad ? rows[0]?.bsc || 0 : 0;
    result.programs_grad_updated = graduate ? rows[0]?.grad || 0 : 0;
    return result;
  }

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

  if (undergrad) {
    const { rowCount } = await db.query(
      `
      UPDATE programs
      SET apply_link = $1::text, updated_at = NOW()
      WHERE uni_id = $2 AND degree_level = 'BSc'
      `,
      [undergrad, uniId],
    );
    result.programs_bsc_updated = rowCount;
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
    result.programs_grad_updated = rowCount;
  }

  return result;
}

async function fixApplyLinksFuzzyMatch({
  file = null,
  dryRun = false,
  countries = EUROPE_COUNTRIES,
} = {}) {
  const universities = loadApplyLinks(file);
  const stats = {
    source: file || 'europe_apply_links.json',
    universities_total: universities.length,
    updated: [],
    exact_match_skipped: [],
    ambiguous: [],
    not_found: [],
    errors: [],
    programs_bsc_updated: 0,
    programs_grad_updated: 0,
  };

  for (const entry of universities) {
    const catalogName = String(entry.name || '').trim();
    const undergrad = String(entry.undergrad_apply_link || '').trim() || null;
    const graduate = String(entry.graduate_apply_link || '').trim() || null;

    if (!catalogName || (!undergrad && !graduate)) {
      stats.not_found.push({ catalog_name: catalogName, reason: 'missing links in catalog' });
      continue;
    }

    try {
      const { rows: exactRows } = await db.query(
        `
        SELECT id, name, country, undergrad_apply_link, graduate_apply_link
        FROM universities
        WHERE name = $1 AND country = ANY($2::text[])
        `,
        [catalogName, countries],
      );

      if (exactRows.length === 1) {
        const exact = exactRows[0];
        const orphanVariants = await findOrphanNameVariants(db, {
          exactRow: exact,
          catalogName,
        });
        const patterns = buildSearchPatterns(catalogName);

        if (!orphanVariants.length) {
          stats.exact_match_skipped.push({
            catalog_name: catalogName,
            db_name: exact.name,
            reason: 'exact match already applied; no fuzzy variants',
          });
          continue;
        }

        if (orphanVariants.length === 1) {
          const orphan = orphanVariants[0];
          const applied = await applyLinksToUniversity(orphan.id, { undergrad, graduate, dryRun });
          stats.updated.push({
            catalog_name: catalogName,
            db_name: orphan.name,
            db_id: orphan.id,
            patterns,
            match_type: 'single_orphan_variant',
            canonical_db_name: exact.name,
            ...applied,
          });
          stats.programs_bsc_updated += applied.programs_bsc_updated;
          stats.programs_grad_updated += applied.programs_grad_updated;
          continue;
        }

        stats.ambiguous.push({
          catalog_name: catalogName,
          exact_db_name: exact.name,
          exact_db_id: exact.id,
          patterns,
          matches: [exact, ...orphanVariants].map((r) => ({
            id: r.id,
            name: r.name,
            country: r.country,
            has_undergrad_link: Boolean(r.undergrad_apply_link),
            has_graduate_link: Boolean(r.graduate_apply_link),
          })),
          orphan_variants: orphanVariants.map((r) => r.name),
          reason: 'exact match exists but additional name variants found — admin review',
        });
        continue;
      }

      const { patterns, rows, matched_pattern: matchedPattern, ambiguous: fuzzyAmbiguous } =
        await findMatchingUniversities(db, {
          catalogName,
          countries,
        });

      if (!rows.length) {
        stats.not_found.push({
          catalog_name: catalogName,
          patterns,
          reason: 'no ILIKE match',
        });
        continue;
      }

      if (fuzzyAmbiguous || rows.length > 1) {
        stats.ambiguous.push({
          catalog_name: catalogName,
          patterns,
          matched_pattern: matchedPattern,
          matches: rows.map((r) => ({
            id: r.id,
            name: r.name,
            country: r.country,
            has_undergrad_link: Boolean(r.undergrad_apply_link),
            has_graduate_link: Boolean(r.graduate_apply_link),
          })),
          reason: 'multiple ILIKE matches — admin review',
        });
        continue;
      }

      const match = rows[0];
      const applied = await applyLinksToUniversity(match.id, { undergrad, graduate, dryRun });

      stats.updated.push({
        catalog_name: catalogName,
        db_name: match.name,
        db_id: match.id,
        patterns,
        ...applied,
      });
      stats.programs_bsc_updated += applied.programs_bsc_updated;
      stats.programs_grad_updated += applied.programs_grad_updated;
    } catch (err) {
      stats.errors.push({
        catalog_name: catalogName,
        message: err?.message || String(err),
      });
    }
  }

  stats.summary = {
    updated_count: stats.updated.length,
    exact_match_skipped_count: stats.exact_match_skipped.length,
    ambiguous_count: stats.ambiguous.length,
    not_found_count: stats.not_found.length,
    error_count: stats.errors.length,
  };

  return stats;
}

module.exports = {
  applyLinksToUniversity,
  fixApplyLinksFuzzyMatch,
};
