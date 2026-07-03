/** @param {import('express').Request} req */
function resolveCatalogLang(req) {
  const q = String(req.query?.lang || '').trim().toLowerCase();
  if (q === 'ru' || q === 'az' || q === 'en') return q;
  const accept = String(req.headers['accept-language'] || '').toLowerCase();
  if (accept.startsWith('ru')) return 'ru';
  if (accept.startsWith('en')) return 'en';
  return 'az';
}

function parseTranslations(raw) {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function localizedField(row, lang, field = 'name') {
  const fallback = row?.[field] != null ? String(row[field]) : '';
  const tr = parseTranslations(row?.translations);
  if (lang === 'ru' && tr.ru) return String(tr.ru);
  if (lang === 'az' && tr.az) return String(tr.az);
  if (lang === 'en' && tr.en) return String(tr.en);
  return fallback;
}

module.exports = { resolveCatalogLang, localizedField, parseTranslations };
