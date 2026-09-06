/** Diacritic-tolerant matcher for Azerbaijani UI/UGC phrases. */

export function azFlexibleRegex(phrase, { wholeWord = false } = {}) {
  const pattern = [...String(phrase || '')]
    .map((ch) => {
      const lower = ch.toLocaleLowerCase('az')
      if (lower === 'ə' || lower === 'e') return '[əeEƏ]'
      if (lower === 'ı' || lower === 'i' || ch === 'İ' || ch === 'I') return '[ıiIİ]'
      if (lower === 'ö' || lower === 'o') return '[öoÖO]'
      if (lower === 'ü' || lower === 'u') return '[üuÜU]'
      if (lower === 'ğ' || lower === 'g') return '[ğgĞG]'
      if (lower === 'ş' || lower === 's') return '[şsŞS]'
      if (lower === 'ç' || lower === 'c') return '[çcÇC]'
      if (/\s/.test(ch)) return '\\s+'
      return ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    })
    .join('')
  const wrapped = wholeWord ? `(?<![\\p{L}\\p{N}])${pattern}(?![\\p{L}\\p{N}])` : pattern
  return new RegExp(wrapped, 'giu')
}

/** @param {Array<{ az: string, en?: string, ru?: string, wholeWord?: boolean }>} phrases */
export function replaceAzPhrases(text, phrases, locale) {
  if (!text || (locale !== 'en' && locale !== 'ru')) return text
  const sorted = [...phrases].sort((a, b) => String(b.az || '').length - String(a.az || '').length)
  let out = String(text)
  for (const row of sorted) {
    const dest = row[locale]
    if (!row.az || !dest) continue
    out = out.replace(azFlexibleRegex(row.az, { wholeWord: Boolean(row.wholeWord) }), dest)
  }
  return out
}
