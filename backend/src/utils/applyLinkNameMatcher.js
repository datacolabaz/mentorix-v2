const GENERIC_NAME_TOKENS = new Set([
  'university',
  'college',
  'institute',
  'school',
  'université',
  'universidad',
]);

function stripParenthetical(name) {
  return String(name || '').replace(/\s*\([^)]+\)\s*$/, '').trim();
}

function isSpecificPattern(value) {
  const token = String(value || '').trim();
  if (token.length < 6) return false;
  if (GENERIC_NAME_TOKENS.has(token.toLowerCase())) return false;
  return true;
}

function buildSearchPatterns(fullName) {
  const name = String(fullName || '').trim();
  const patterns = new Set();

  if (!name) return [];

  patterns.add(name);

  const withoutParens = stripParenthetical(name);
  if (withoutParens) patterns.add(withoutParens);

  if (withoutParens.endsWith(' University')) {
    patterns.add(withoutParens.slice(0, -' University'.length));
  }

  const ofMatch = withoutParens.match(/^(.+?)\s+of\s+(.+)$/i);
  if (ofMatch) {
    const prefix = ofMatch[1].trim();
    const isGenericPrefix = /^(Technical University|University College|University)$/i.test(prefix);
    if (isSpecificPattern(prefix) && !isGenericPrefix) {
      patterns.add(prefix);
    }
  }

  return [...patterns]
    .filter(isSpecificPattern)
    .sort((a, b) => b.length - a.length);
}

async function findMatchingUniversities(db, {
  catalogName,
  countries = [],
}) {
  const patterns = buildSearchPatterns(catalogName);
  if (!patterns.length) return { patterns, rows: [], matched_pattern: null };

  for (const pattern of patterns) {
    const { rows } = await db.query(
      `
      SELECT id, name, country, undergrad_apply_link, graduate_apply_link
      FROM universities
      WHERE country = ANY($1::text[])
        AND name ILIKE $2
      ORDER BY name
      `,
      [countries, `%${pattern}%`],
    );

    if (rows.length === 1) {
      return { patterns, rows, matched_pattern: pattern };
    }

    if (rows.length > 1) {
      return { patterns, rows, matched_pattern: pattern, ambiguous: true };
    }
  }

  return { patterns, rows: [], matched_pattern: null };
}

async function findOrphanNameVariants(db, {
  exactRow,
  catalogName,
}) {
  const names = [...new Set([exactRow.name, catalogName].filter(Boolean))];
  const byId = new Map();

  for (const anchor of names) {
    const { rows } = await db.query(
      `
      SELECT id, name, country, undergrad_apply_link, graduate_apply_link
      FROM universities
      WHERE country = $1
        AND id != $2
        AND (
          $3 ILIKE '%' || name || '%'
          OR name ILIKE '%' || $3 || '%'
        )
      ORDER BY name
      `,
      [exactRow.country, exactRow.id, anchor],
    );

    for (const row of rows) {
      byId.set(row.id, row);
    }
  }

  return [...byId.values()];
}

module.exports = {
  stripParenthetical,
  isSpecificPattern,
  buildSearchPatterns,
  findMatchingUniversities,
  findOrphanNameVariants,
};
