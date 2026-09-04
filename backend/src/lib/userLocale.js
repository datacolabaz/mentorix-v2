function normalizeLocale(raw) {
  const s = String(raw || '')
    .trim()
    .toLowerCase();
  if (s.startsWith('ru')) return 'ru';
  if (s.startsWith('en')) return 'en';
  if (s.startsWith('az')) return 'az';
  return 'az';
}

/** Prefer body.locale, then Accept-Language (frontend already sets this from the language switcher). */
function localeFromReq(req) {
  const body = req?.body?.locale;
  if (body != null && String(body).trim()) return normalizeLocale(body);
  return normalizeLocale(req?.headers?.['accept-language']);
}

async function persistUserLocale(db, userId, locale) {
  if (!userId) return normalizeLocale(locale);
  const lang = normalizeLocale(locale);
  await db.query(`UPDATE users SET locale = $2 WHERE id = $1 AND deleted_at IS NULL`, [userId, lang]);
  return lang;
}

module.exports = { normalizeLocale, localeFromReq, persistUserLocale };
