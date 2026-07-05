const AZ_CHARS = 'əıöüşçğ';
const AZ_LATIN = 'eiousscg';

function transliterateAz(text) {
  let out = '';
  const s = String(text || '');
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    const lower = ch.toLowerCase();
    const idx = AZ_CHARS.indexOf(lower);
    if (idx >= 0) out += AZ_LATIN[idx];
    else out += ch;
  }
  return out;
}

function slugifyExamTitle(title) {
  const base = transliterateAz(title)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  return base || 'imtahan';
}

async function generateUniqueExamSlug(client, title, excludeId = null) {
  const base = slugifyExamTitle(title);
  let candidate = base;
  let suffix = 2;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const params = excludeId ? [candidate, excludeId] : [candidate];
    const sql = excludeId
      ? `SELECT 1 FROM exams WHERE slug = $1 AND id <> $2::uuid LIMIT 1`
      : `SELECT 1 FROM exams WHERE slug = $1 LIMIT 1`;
    const { rows } = await client.query(sql, params);
    if (!rows.length) return candidate;
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

module.exports = { slugifyExamTitle, generateUniqueExamSlug };
