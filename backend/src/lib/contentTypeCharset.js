'use strict';

/**
 * Mətn faylları (TXT, CSV, Python və s.) brauzerdə UTF-8 kimi göstərilsin.
 * charset olmadan brauzer ISO-8859-1 götürür — az hərfləri (ə, ş, ö) pozulur.
 */
function withUtf8Charset(contentType) {
  const raw = String(contentType || 'application/octet-stream').trim();
  if (!raw) return 'application/octet-stream';
  if (/charset=/i.test(raw)) return raw;
  const base = raw.split(';')[0].trim().toLowerCase();
  if (base.startsWith('text/') || base === 'application/json') {
    return `${base}; charset=utf-8`;
  }
  return raw.split(';')[0].trim() || 'application/octet-stream';
}

module.exports = { withUtf8Charset };
