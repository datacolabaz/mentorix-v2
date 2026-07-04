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
  const isTitle = field === 'title';
  const baseKey = isTitle ? 'title' : 'name';
  const ruKey = isTitle ? 'title_ru' : 'name_ru';
  const fallback =
    row?.[baseKey] != null
      ? String(row[baseKey])
      : row?.[field] != null
        ? String(row[field])
        : '';

  if (lang === 'ru') {
    const ruVal = row?.[ruKey];
    if (ruVal != null && String(ruVal).trim()) return String(ruVal).trim();
  }

  const tr = parseTranslations(row?.translations);
  if (lang === 'ru' && tr.ru) return String(tr.ru);
  if (lang === 'az' && tr.az) return String(tr.az);
  if (lang === 'en' && tr.en) return String(tr.en);
  return fallback;
}

function localizedDescription(row, lang) {
  if (lang === 'ru' && row?.description_ru != null && String(row.description_ru).trim()) {
    return String(row.description_ru).trim();
  }
  const tr = parseTranslations(row?.translations);
  if (lang === 'ru' && tr.description_ru) return String(tr.description_ru);
  if (lang === 'az' && tr.description_az) return String(tr.description_az);
  return row?.description != null ? String(row.description) : '';
}

module.exports = { resolveCatalogLang, localizedField, localizedDescription, parseTranslations };
