const TZ = 'Asia/Baku';

/** DB/API timestamp → UTC Date (timezone-siz stringlər UTC hesab olunur). */
function parseUtcInstant(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  const s = String(v).trim();
  if (!s) return null;
  if (/[zZ]$|[+-]\d{2}(:\d{2})?$/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const norm = s.includes('T') ? s : s.replace(' ', 'T');
  const d = new Date(norm.endsWith('Z') ? norm : `${norm}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** UTC instant → Bakı vaxtı `YYYY-MM-DD HH:mm`. */
function formatBakuYmdHm(v) {
  const d = parseUtcInstant(v);
  if (!d) return null;
  const date = d.toLocaleDateString('en-CA', { timeZone: TZ });
  const time = d.toLocaleTimeString('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${date} ${time}`;
}

function withBakuDisplayTimes(row, keys) {
  const out = { ...row };
  for (const key of keys) {
    if (row[key] != null) out[`${key}_az`] = formatBakuYmdHm(row[key]);
  }
  return out;
}

module.exports = { parseUtcInstant, formatBakuYmdHm, withBakuDisplayTimes };
