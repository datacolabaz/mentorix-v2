'use strict';

const crypto = require('crypto');

const BRAND = Object.freeze({
  name: 'Sualix',
  tagline: 'İmtahan • Tapşırıq • Nəticə',
});

/** Bump when the card layout or copy rules change so crawlers refetch images. */
const TEMPLATE_VERSION = 1;

const MAX_PATH_LENGTH = 300;
const SAFE_PARAM = /^[A-Za-z0-9_-]{1,128}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Allowlist of routes that may produce a content-specific preview. Order matters:
 * more specific patterns first. Anything else falls back to the homepage card.
 * `result` and `certificate` never read content; they always render a generic card.
 */
const SHARE_ROUTES = Object.freeze([
  { kind: 'home', re: /^\/$/, keys: [] },
  { kind: 'exam', re: /^\/exam\/([^/]+)$/, keys: ['examId'] },
  { kind: 'task', re: /^\/task\/([^/]+)$/, keys: ['taskId'] },
  { kind: 'material', re: /^\/library\/material\/([^/]+)$/, keys: ['materialId'] },
  { kind: 'material', re: /^\/m\/([^/]+)$/, keys: ['shareToken'] },
  { kind: 'group', re: /^\/library\/([^/]+)$/, keys: ['groupId'] },
  { kind: 'group', re: /^\/join\/([^/]+)$/, keys: ['code'] },
  { kind: 'live', re: /^\/live\/join\/([^/]+)$/, keys: ['guestToken'] },
  { kind: 'live', re: /^\/lr\/([^/]+)$/, keys: ['recordingToken'] },
  { kind: 'teacher', re: /^\/teachers\/([^/]+)$/, keys: ['teacherId'] },
  { kind: 'certified', re: /^\/sertifikatli-imtahanlar\/([^/]+)\/([^/]+)$/, keys: ['categorySlug', 'examSlug'] },
  { kind: 'certified', re: /^\/sertifikatli-imtahanlar\/([^/]+)$/, keys: ['categorySlug'] },
  { kind: 'certified', re: /^\/sertifikatli-imtahanlar$/, keys: [] },
  { kind: 'certificate', re: /^\/c\/[^/]+$/, keys: [] },
  { kind: 'result', re: /^\/(student|parent)(\/.*)?$/, keys: [] },
]);

const PREVIEW_KINDS = Object.freeze([...new Set(SHARE_ROUTES.map((r) => r.kind))]);

function normalizeSharePath(raw) {
  let p = String(raw || '').trim();
  if (!p) return '/';
  if (/^https?:\/\//i.test(p)) {
    try {
      p = new URL(p).pathname;
    } catch {
      return '/';
    }
  }
  p = p.split(/[?#]/)[0];
  if (!p.startsWith('/') || p.length > MAX_PATH_LENGTH || p.includes('..') || p.includes('//')) return '/';
  if (p.length > 1) p = p.replace(/\/+$/, '');
  return p || '/';
}

function matchSharePath(raw) {
  const path = normalizeSharePath(raw);
  for (const route of SHARE_ROUTES) {
    const m = route.re.exec(path);
    if (!m) continue;
    const params = {};
    let valid = true;
    route.keys.forEach((key, i) => {
      let value = m[i + 1];
      try {
        value = decodeURIComponent(value);
      } catch {
        valid = false;
      }
      if (!SAFE_PARAM.test(String(value || ''))) valid = false;
      params[key] = value;
    });
    if (!valid) return { kind: route.kind, path, params: {}, invalid: true };
    return { kind: route.kind, path, params };
  }
  return { kind: 'home', path: '/', params: {} };
}

function isUuid(value) {
  return UUID.test(String(value || ''));
}

function cleanText(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function clampText(value, max) {
  const s = cleanText(value);
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  const base = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${base.replace(/[\s,.;:·—-]+$/, '')}…`;
}

const AZ_MONTHS = [
  'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avqust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr',
];

const BAKU_TZ = 'Asia/Baku';

function bakuParts(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: BAKU_TZ,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    time: `${get('hour')}:${get('minute')}`,
  };
}

function formatAzDate({ year, month, day }, now = new Date()) {
  const current = bakuParts(now);
  const base = `${day} ${AZ_MONTHS[month - 1]}`;
  return current && current.year === year ? base : `${base} ${year}`;
}

/** "29 sentyabr, 19:00" in Baku time. */
function formatAzDateTime(date, now = new Date()) {
  const p = bakuParts(date);
  if (!p) return '';
  return `${formatAzDate(p, now)}, ${p.time}`;
}

/** Postgres DATE rendered as YYYY-MM-DD; formatted without timezone shifts. */
function formatAzDay(isoDay, now = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(isoDay || ''));
  if (!m) return '';
  return formatAzDate({ year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) }, now);
}

function materialTypeLabel(fileType, fileName) {
  const t = String(fileType || '').toLowerCase();
  const ext = String(fileName || '').toLowerCase().split('.').pop();
  if (t.includes('pdf') || ext === 'pdf') return 'PDF';
  if (t.startsWith('video/') || ['mp4', 'mov', 'webm', 'mkv'].includes(ext)) return 'Video';
  if (t.startsWith('audio/') || ['mp3', 'wav', 'm4a', 'ogg'].includes(ext)) return 'Audio';
  if (t.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return 'Şəkil';
  if (t.includes('presentation') || t.includes('powerpoint') || ['ppt', 'pptx', 'key', 'odp'].includes(ext)) {
    return 'Təqdimat';
  }
  if (t.includes('link') || t === 'url') return 'Link';
  if (
    t.includes('word') || t.includes('document') || t.startsWith('text/') ||
    ['doc', 'docx', 'txt', 'rtf', 'odt', 'xls', 'xlsx'].includes(ext)
  ) {
    return 'Sənəd';
  }
  return 'Material';
}

function joinDot(parts) {
  return parts.map(cleanText).filter(Boolean).join(' · ');
}

const HOME_TITLE = `${BRAND.name} — İmtahan, tapşırıq və nəticə platforması`;
const HOME_DESCRIPTION =
  'Müəllimlər üçün imtahan, tapşırıq və material idarəetməsi. Tələbələr üçün daha aydın nəticə və inkişaf.';

/**
 * Builds preview copy for a kind. `data` is null when the entity is missing,
 * private or expired; the result is then a generic card for that kind.
 * Only fields explicitly read here can ever reach the preview.
 */
function buildPreviewCopy(kind, data, { now = new Date() } = {}) {
  switch (kind) {
    case 'exam': {
      if (!data?.title) {
        return {
          title: `İmtahana dəvət — ${BRAND.name}`,
          description: 'İmtahana qoşulmaq üçün linki açın.',
          card: { eyebrow: 'İmtahana dəvət', title: 'Sizi imtahana dəvət edirlər', lines: [] },
        };
      }
      const qCount = Number(data.questionCount) > 0 ? `${Number(data.questionCount)} sual` : '';
      const duration = Number(data.durationMinutes) > 0 ? `${Number(data.durationMinutes)} dəqiqə` : '';
      const meta = joinDot([qCount, duration]);
      const startsAt = data.startsAt && new Date(data.startsAt).getTime() > now.getTime()
        ? formatAzDateTime(data.startsAt, now)
        : '';
      return {
        title: `İmtahana dəvət — ${clampText(data.title, 70)}`,
        description: joinDot([data.subject, qCount, duration]) || 'İmtahana qoşulmaq üçün linki açın.',
        card: {
          eyebrow: 'İmtahana dəvət',
          title: clampText(data.title, 80),
          lines: [cleanText(data.subject), meta].filter(Boolean),
          footnote: startsAt ? `Başlama: ${startsAt}` : '',
        },
      };
    }
    case 'task': {
      if (!data?.title) {
        return {
          title: `Yeni tapşırıq — ${BRAND.name}`,
          description: 'Tapşırığa baxmaq üçün linki açın.',
          card: { eyebrow: 'Yeni tapşırıq', title: 'Sizə yeni tapşırıq göndərilib', lines: [] },
        };
      }
      const due = data.dueDay ? formatAzDay(data.dueDay, now) : '';
      return {
        title: `Yeni tapşırıq — ${clampText(data.title, 70)}`,
        description: due ? `Son tarix: ${due}` : 'Tapşırığa baxmaq üçün linki açın.',
        card: {
          eyebrow: 'Yeni tapşırıq',
          title: clampText(data.title, 80),
          lines: [cleanText(data.subject)].filter(Boolean),
          footnote: due ? `Son tarix: ${due}` : '',
        },
      };
    }
    case 'material': {
      if (!data?.title) {
        return {
          title: `Yeni material — ${BRAND.name}`,
          description: 'Tədris materialına baxmaq üçün linki açın.',
          card: { eyebrow: 'Yeni tədris materialı', title: 'Sizinlə material paylaşılıb', lines: [] },
        };
      }
      const type = materialTypeLabel(data.fileType, data.fileName);
      return {
        title: `Yeni material — ${clampText(data.title, 70)}`,
        description: joinDot([type, data.subject]),
        card: {
          eyebrow: 'Yeni tədris materialı',
          title: clampText(data.title, 80),
          lines: [joinDot([type, data.subject])].filter(Boolean),
        },
      };
    }
    case 'live': {
      const eyebrow = data?.recording ? 'Canlı dərs yazısı' : 'Canlı dərs';
      if (!data?.title) {
        return {
          title: `${eyebrow} — ${BRAND.name}`,
          description: data?.recording ? 'Dərs yazısına baxmaq üçün linki açın.' : 'Canlı dərsə qoşulmaq üçün linki açın.',
          card: { eyebrow, title: data?.recording ? 'Dərs yazısı paylaşılıb' : 'Canlı dərsə dəvət', lines: [] },
        };
      }
      const when = data.at ? formatAzDateTime(data.at, now) : '';
      const [day, time] = when ? when.split(', ') : ['', ''];
      return {
        title: `${eyebrow} — ${clampText(data.title, 70)}`,
        description: joinDot([day, time]) || 'Canlı dərsə qoşulmaq üçün linki açın.',
        card: {
          eyebrow,
          title: clampText(data.title, 80),
          lines: [joinDot([day, time])].filter(Boolean),
        },
      };
    }
    case 'group': {
      if (!data?.name) {
        return {
          title: `${BRAND.name} qrupuna dəvət`,
          description: 'Qrupa qoşulmaq üçün linki açın.',
          card: { eyebrow: 'Qrupa dəvət', title: 'Sizi qrupa dəvət edirlər', lines: [] },
        };
      }
      const name = clampText(data.name, 60);
      return {
        title: `${BRAND.name} qrupuna dəvət`,
        description: `${name} qrupuna qoşulun`,
        card: {
          eyebrow: 'Qrupa dəvət',
          title: name,
          lines: [
            cleanText(data.subject),
            data.publicTeacherName ? `Müəllim: ${cleanText(data.publicTeacherName)}` : '',
          ].filter(Boolean),
        },
      };
    }
    case 'teacher': {
      if (!data?.name) {
        return {
          title: `${BRAND.name} müəllim profili`,
          description: 'Müəllimin dərsləri, imtahanları və materialları.',
          card: { eyebrow: 'Müəllim profili', title: 'Müəllim profili', lines: [] },
        };
      }
      const subjects = clampText(data.subjects, 60);
      return {
        title: `${clampText(data.name, 60)} — ${BRAND.name} müəllim profili`,
        description: subjects
          ? `${subjects} üzrə dərslər, imtahanlar və materiallar`
          : 'Dərslər, imtahanlar və materiallar',
        card: {
          eyebrow: 'Müəllim profili',
          title: clampText(data.name, 60),
          lines: [subjects, clampText(data.headline, 90)].filter(Boolean),
        },
      };
    }
    case 'certified': {
      if (!data?.title) {
        return {
          title: `Sertifikatlı imtahanlar — ${BRAND.name}`,
          description: 'Biliyini imtahanla yoxla, QR kodu ilə doğrulanan sertifikat qazan.',
          card: { eyebrow: 'Sertifikatlı imtahanlar', title: 'Biliyini sertifikatla təsdiqlə', lines: [] },
        };
      }
      const pass = Number(data.passPct) > 0 ? `Keçid balı: ${Number(data.passPct)}%` : '';
      return {
        title: `${clampText(data.title, 70)} — Sertifikatlı imtahan`,
        description: joinDot(['QR kodu ilə doğrulanan sertifikat', pass]),
        card: {
          eyebrow: 'Sertifikatlı imtahan',
          title: clampText(data.title, 80),
          lines: [pass].filter(Boolean),
        },
      };
    }
    case 'certificate':
      return {
        title: `${BRAND.name} sertifikatı`,
        description: 'Sertifikatı doğrulamaq üçün linki açın.',
        card: { eyebrow: 'Sertifikat', title: 'Sertifikatı doğrula', lines: ['QR kodu ilə təsdiqlənən sənəd'] },
      };
    case 'result':
      return {
        title: `${BRAND.name} nəticəsi`,
        description: 'Nəticənizi təhlükəsiz şəkildə görüntüləmək üçün linki açın.',
        card: {
          eyebrow: 'Nəticə',
          title: 'Nəticənizi təhlükəsiz görüntüləyin',
          lines: ['Şəxsi məlumatlar yalnız daxil olduqdan sonra görünür'],
        },
      };
    case 'home':
    default:
      return {
        title: HOME_TITLE,
        description: HOME_DESCRIPTION,
        card: {
          eyebrow: 'İmtahan, tapşırıq və nəticə platforması',
          title: 'Müəllim üçün idarəetmə, tələbə üçün aydın nəticə',
          lines: ['İmtahan · Tapşırıq · Material · Nəticə'],
        },
      };
  }
}

function previewVersion(kind, card) {
  return crypto
    .createHash('sha1')
    .update(JSON.stringify({ v: TEMPLATE_VERSION, kind, card }))
    .digest('hex')
    .slice(0, 12);
}

/** Full payload consumed by the HTML injector and the image generator. */
function buildSharePreview({ kind, path, data, siteOrigin, now = new Date() }) {
  const copy = buildPreviewCopy(kind, data, { now });
  const card = {
    eyebrow: copy.card.eyebrow,
    title: copy.card.title,
    lines: (copy.card.lines || []).slice(0, 2),
    footnote: copy.card.footnote || '',
  };
  const origin = String(siteOrigin || '').replace(/\/+$/, '');
  const canonicalPath = kind === 'home' ? '/' : path;
  return {
    success: true,
    kind,
    site_name: BRAND.name,
    brand: BRAND,
    title: clampText(copy.title, 95),
    description: clampText(copy.description, 160),
    url: `${origin}${canonicalPath}`,
    canonical_path: canonicalPath,
    image_alt: clampText(`${BRAND.name} — ${card.eyebrow}: ${card.title}`, 120),
    card,
    version: previewVersion(kind, card),
    og_type: kind === 'teacher' ? 'profile' : 'website',
  };
}

module.exports = {
  BRAND,
  TEMPLATE_VERSION,
  SHARE_ROUTES,
  PREVIEW_KINDS,
  normalizeSharePath,
  matchSharePath,
  isUuid,
  clampText,
  cleanText,
  formatAzDateTime,
  formatAzDay,
  materialTypeLabel,
  buildPreviewCopy,
  buildSharePreview,
  previewVersion,
};
