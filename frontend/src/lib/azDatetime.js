const TZ = 'Asia/Baku';

function parseUtcInstant(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const s = String(value).trim();
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

/** UTC instant → Bakı vaxtı, `YYYY-MM-DD HH:mm` formatında. */
export function fmtAzBakuYmdHm(iso) {
  const d = parseUtcInstant(iso);
  if (!d) return ''
  const date = d.toLocaleDateString('en-CA', { timeZone: TZ })
  const time = d.toLocaleTimeString('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  return `${date} ${time}`
}

/** Qrupa qoşulma tarixi — dd.MM.yyyy (Bakı). */
export function fmtAzJoinDate(value) {
  const d = parseUtcInstant(value)
  if (!d) return '—'
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(d)
  const get = (t) => parts.find((p) => p.type === t)?.value || ''
  return `${get('day')}.${get('month')}.${get('year')}`
}

/** API `*_az` sahəsi varsa onu, yoxdursa UTC-dən çevir. */
export function fmtAzBakuField(row, key) {
  const az = row?.[`${key}_az`]
  if (az) return az
  return fmtAzBakuYmdHm(row?.[key])
}
