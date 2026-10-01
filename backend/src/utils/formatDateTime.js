/**
 * Backend twin of frontend/src/lib/formatDateTime.js (emails, server-rendered text).
 * Asia/Baku time; month names never come from Intl (Node ICU builds differ).
 *   az, ru:        29.09.2026, 21:34
 *   en (tr, de):   Sep 29, 2026, 21:34
 * Zone-less DB strings (e.g. notifications.created_at) are read as UTC.
 */
const { parseUtcInstant } = require('./azDatetime');

const ENGLISH_STYLE = new Set(['en', 'tr', 'de']);
const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function zonedParts(d, timeZone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return {
    day: Number(get('day')),
    month: Number(get('month')),
    year: Number(get('year')),
    hour: get('hour'),
    minute: get('minute'),
  };
}

function formatDateTime(value, locale, opts = {}) {
  const d = parseUtcInstant(value);
  if (!d) return '';
  const p = zonedParts(d, opts.timeZone || 'Asia/Baku');
  if (!p.day || !p.month || !p.year) return '';
  const l = String(locale || '').toLowerCase().split(/[-_]/)[0];
  if (ENGLISH_STYLE.has(l)) {
    return `${EN_MONTHS[p.month - 1]} ${p.day}, ${p.year}, ${p.hour}:${p.minute}`;
  }
  return `${String(p.day).padStart(2, '0')}.${String(p.month).padStart(2, '0')}.${p.year}, ${p.hour}:${p.minute}`;
}

/**
 * Calendar dates without a time (Postgres DATE, e.g. assignments.due_date).
 * pg parses DATE as local midnight, so local getters give the stored day in any server TZ.
 *   az, ru: 29.09.2026   en: Sep 29, 2026
 */
function formatDateOnly(value, locale) {
  let y;
  let m;
  let d;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    y = value.getFullYear();
    m = value.getMonth() + 1;
    d = value.getDate();
  } else {
    const hit = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || '').trim());
    if (!hit) return '';
    y = Number(hit[1]);
    m = Number(hit[2]);
    d = Number(hit[3]);
  }
  if (!y || m < 1 || m > 12 || !d) return '';
  const l = String(locale || '').toLowerCase().split(/[-_]/)[0];
  if (ENGLISH_STYLE.has(l)) return `${EN_MONTHS[m - 1]} ${d}, ${y}`;
  return `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}`;
}

module.exports = { formatDateTime, formatDateOnly };
