const {
  FIELD_BY_VALUE,
  fieldMeta,
  fieldSearchTerms,
  flatFieldOptions,
} = require('../constants/universityFieldCatalog');

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

function normalizeToken(s) {
  return foldAz(s).replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Mastersportal / Studyportals sahə adlarını kataloq slug-larına map edir */
function resolveFieldSlug(raw, hint = null) {
  const token = String(raw || '').trim();
  const hintSlug = hint ? String(hint).trim() : null;

  if (hintSlug && fieldMeta(hintSlug)) {
    return { slug: hintSlug, needsReview: false, matchedBy: 'hint' };
  }

  if (token && fieldMeta(token)) {
    return { slug: token, needsReview: false, matchedBy: 'slug' };
  }

  const folded = normalizeToken(token);
  if (!folded && hintSlug) {
    return { slug: hintSlug, needsReview: false, matchedBy: 'hint_fallback' };
  }

  let best = null;
  let bestScore = 0;

  for (const [slug, meta] of FIELD_BY_VALUE.entries()) {
    const candidates = [
      slug,
      slug.replace(/_/g, ' '),
      slug.replace(/_/g, '-'),
      meta.label,
      ...fieldSearchTerms(slug),
    ]
      .map(normalizeToken)
      .filter(Boolean);

    for (const candidate of candidates) {
      if (!candidate || candidate.length < 3) continue;
      if (folded === candidate) {
        return { slug, needsReview: false, matchedBy: 'exact' };
      }
      if (folded.includes(candidate) || candidate.includes(folded)) {
        const score = Math.min(folded.length, candidate.length);
        if (score > bestScore) {
          bestScore = score;
          best = slug;
        }
      }
    }
  }

  if (best) {
    return { slug: best, needsReview: false, matchedBy: 'fuzzy' };
  }

  const fallback = hintSlug || token.replace(/\s+/g, '_').toLowerCase().slice(0, 64) || 'general_studies';
  return { slug: fallback, needsReview: true, matchedBy: 'unmatched' };
}

function primaryEnglishFieldLabel(fieldSlug) {
  const terms = fieldSearchTerms(fieldSlug);
  const english = terms.find((t) => /^[A-Za-z][A-Za-z\s/&-]{2,}$/.test(String(t).trim()));
  if (english) return String(english).trim();
  const meta = fieldMeta(fieldSlug);
  if (meta?.label) {
    const fromParen = meta.label.match(/\(([^)]+)\)/);
    if (fromParen) return fromParen[1].trim();
    return meta.label.split(/[/,]/)[0].trim();
  }
  return fieldSlug.replace(/_/g, ' ');
}

module.exports = {
  resolveFieldSlug,
  primaryEnglishFieldLabel,
  flatFieldOptions,
};
