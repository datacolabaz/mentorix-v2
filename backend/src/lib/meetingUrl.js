/**
 * Müəllimin daxil etdiyi canlı dərs linkinin yoxlanması (server tərəfi — yeganə mənbə).
 * Mentorix video yayımı etmir: link Google Meet / Zoom / müəllimin seçdiyi digər HTTPS platformaya aparır.
 *   google_meet: https://meet.google.com/abc-defg-hij
 *   zoom:        https://<sub>.zoom.us/j/<id>  və ya  https://<sub>.zoom.us/my/<ad>
 *   other:       yalnız https://, istifadəçi adı/parol yox, IP/localhost yox, yönləndirici parametr yox.
 * Frontend eyni qaydaları təkrarlayır (frontend/src/lib/meetingUrl.js), amma qərar serverdədir.
 */

const PLATFORMS = Object.freeze(['google_meet', 'zoom', 'other']);
const MAX_URL_LENGTH = 500;

const MEET_HOST = 'meet.google.com';
const MEET_CODE_RE = /^\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/;
const ZOOM_HOST_RE = /^(?:[a-z0-9-]+\.)*zoom\.us$/;
const ZOOM_PATH_RE = /^\/(?:j\/\d{9,11}|my\/[a-z0-9._-]{1,64})\/?$/i;

/** Başqa sayta yönləndirmə üçün istifadə olunan parametr adları (open redirect). */
const REDIRECT_PARAM_RE = /^(?:redirect|redirect_uri|redirect_url|return|returnto|return_to|returnurl|next|url|continue|dest|destination|goto|target|r|u)$/i;

const ERRORS = Object.freeze({
  REQUIRED: 'Görüş linkini daxil edin.',
  TOO_LONG: 'Link çox uzundur.',
  INVALID: 'Link düzgün formatda deyil. Tam linki kopyalayıb yapışdırın (https:// ilə başlamalıdır).',
  HTTPS_ONLY: 'Yalnız təhlükəsiz https:// linkləri qəbul olunur.',
  CREDENTIALS: 'Linkdə istifadəçi adı və ya parol olmamalıdır.',
  MEET_FORMAT: 'Google Meet linki bu formatda olmalıdır: https://meet.google.com/abc-defg-hij',
  ZOOM_FORMAT: 'Zoom linki bu formatda olmalıdır: https://zoom.us/j/1234567890 (və ya https://ad.zoom.us/my/otaq)',
  PRIVATE_HOST: 'Daxili şəbəkə və ya IP ünvanlı linklər qəbul olunmur.',
  REDIRECT: 'Başqa sayta yönləndirən linklər qəbul olunmur. Platformanın birbaşa görüş linkini daxil edin.',
  PLATFORM: 'Platforma seçin: Google Meet, Zoom və ya Digər.',
  PLATFORM_MISMATCH_MEET: 'Bu Google Meet linkidir — platforma olaraq “Google Meet” seçin.',
  PLATFORM_MISMATCH_ZOOM: 'Bu Zoom linkidir — platforma olaraq “Zoom” seçin.',
});

function normalizePlatform(raw) {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
  if (s === 'meet' || s === 'google' || s === 'googlemeet') return 'google_meet';
  return PLATFORMS.includes(s) ? s : null;
}

function isIpOrLocalHost(host) {
  const h = String(host || '').toLowerCase();
  if (!h || h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(h)) return true;
  if (h.startsWith('[') || h.includes(':')) return true;
  if (!h.includes('.')) return true;
  return false;
}

function hasRedirectParam(u) {
  for (const [key, value] of u.searchParams) {
    if (REDIRECT_PARAM_RE.test(key) && /^(?:[a-z][a-z0-9+.-]*:|\/\/|%2f%2f)/i.test(String(value).trim())) return true;
  }
  return false;
}

function fail(error, code) {
  return { ok: false, error, code };
}

/**
 * @param {string} rawUrl
 * @param {string} platformRaw  google_meet | zoom | other
 * @returns {{ ok: true, url: string, platform: string } | { ok: false, error: string, code: string }}
 */
function validateMeetingUrl(rawUrl, platformRaw) {
  const platform = normalizePlatform(platformRaw);
  if (!platform) return fail(ERRORS.PLATFORM, 'PLATFORM');
  const raw = String(rawUrl ?? '').trim();
  if (!raw) return fail(ERRORS.REQUIRED, 'REQUIRED');
  if (raw.length > MAX_URL_LENGTH) return fail(ERRORS.TOO_LONG, 'TOO_LONG');
  // Görünməz/idarəedici simvollar və boşluq — linki saxtalaşdırmaq üçün istifadə olunur.
  if (/[\s\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069\\<>"'`]/.test(raw)) {
    return fail(ERRORS.INVALID, 'INVALID');
  }
  if (!/^https:\/\//i.test(raw)) {
    return /^[a-z][a-z0-9+.-]*:/i.test(raw) ? fail(ERRORS.HTTPS_ONLY, 'HTTPS_ONLY') : fail(ERRORS.INVALID, 'INVALID');
  }
  let u;
  try {
    u = new URL(raw);
  } catch {
    return fail(ERRORS.INVALID, 'INVALID');
  }
  if (u.protocol !== 'https:') return fail(ERRORS.HTTPS_ONLY, 'HTTPS_ONLY');
  if (u.username || u.password) return fail(ERRORS.CREDENTIALS, 'CREDENTIALS');
  if (u.port && u.port !== '443') return fail(ERRORS.INVALID, 'INVALID');
  const host = u.hostname.toLowerCase();
  if (isIpOrLocalHost(host)) return fail(ERRORS.PRIVATE_HOST, 'PRIVATE_HOST');

  const isMeetHost = host === MEET_HOST;
  const isZoomHost = ZOOM_HOST_RE.test(host);

  if (platform === 'google_meet') {
    if (!isMeetHost) return fail(isZoomHost ? ERRORS.PLATFORM_MISMATCH_ZOOM : ERRORS.MEET_FORMAT, 'MEET_FORMAT');
    const path = u.pathname.toLowerCase().replace(/\/$/, '');
    if (!MEET_CODE_RE.test(path)) return fail(ERRORS.MEET_FORMAT, 'MEET_FORMAT');
    const keep = new URLSearchParams();
    const authuser = u.searchParams.get('authuser');
    if (authuser && /^\d{1,2}$/.test(authuser)) keep.set('authuser', authuser);
    const qs = keep.toString();
    return { ok: true, platform, url: `https://${MEET_HOST}${path}${qs ? `?${qs}` : ''}` };
  }

  if (platform === 'zoom') {
    if (!isZoomHost) return fail(isMeetHost ? ERRORS.PLATFORM_MISMATCH_MEET : ERRORS.ZOOM_FORMAT, 'ZOOM_FORMAT');
    if (!ZOOM_PATH_RE.test(u.pathname)) return fail(ERRORS.ZOOM_FORMAT, 'ZOOM_FORMAT');
    const keep = new URLSearchParams();
    const pwd = u.searchParams.get('pwd');
    if (pwd && /^[A-Za-z0-9._-]{1,128}$/.test(pwd)) keep.set('pwd', pwd);
    const qs = keep.toString();
    return { ok: true, platform, url: `https://${host}${u.pathname.replace(/\/$/, '')}${qs ? `?${qs}` : ''}` };
  }

  if (isMeetHost) return fail(ERRORS.PLATFORM_MISMATCH_MEET, 'PLATFORM_MISMATCH');
  if (isZoomHost) return fail(ERRORS.PLATFORM_MISMATCH_ZOOM, 'PLATFORM_MISMATCH');
  if (hasRedirectParam(u)) return fail(ERRORS.REDIRECT, 'REDIRECT');
  return { ok: true, platform, url: u.toString() };
}

/** Dərs materialı linki: yalnız təhlükəsiz HTTPS (görüş platformasına bağlı deyil). */
function validateResourceUrl(rawUrl) {
  const raw = String(rawUrl ?? '').trim();
  if (!raw) return fail(ERRORS.REQUIRED, 'REQUIRED');
  if (raw.length > MAX_URL_LENGTH) return fail(ERRORS.TOO_LONG, 'TOO_LONG');
  if (/[\s\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069\\<>"'`]/.test(raw)) {
    return fail(ERRORS.INVALID, 'INVALID');
  }
  if (!/^https:\/\//i.test(raw)) return fail(ERRORS.HTTPS_ONLY, 'HTTPS_ONLY');
  let u;
  try {
    u = new URL(raw);
  } catch {
    return fail(ERRORS.INVALID, 'INVALID');
  }
  if (u.protocol !== 'https:') return fail(ERRORS.HTTPS_ONLY, 'HTTPS_ONLY');
  if (u.username || u.password) return fail(ERRORS.CREDENTIALS, 'CREDENTIALS');
  if (u.port && u.port !== '443') return fail(ERRORS.INVALID, 'INVALID');
  if (isIpOrLocalHost(u.hostname)) return fail(ERRORS.PRIVATE_HOST, 'PRIVATE_HOST');
  if (hasRedirectParam(u)) return fail(ERRORS.REDIRECT, 'REDIRECT');
  return { ok: true, url: u.toString() };
}

/** Loglar üçün: host qalır, görüş kodu/parol gizlədilir. */
function maskMeetingUrl(rawUrl) {
  const raw = String(rawUrl ?? '').trim();
  if (!raw) return '';
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.hostname}/***`;
  } catch {
    return '***';
  }
}

/** Mətndə rast gəlinən bütün http(s) linklərini maskalayır (xəta mesajları, provider cavabları). */
function maskUrlsInText(text) {
  return String(text ?? '').replace(/https?:\/\/[^\s"'<>]+/gi, (m) => maskMeetingUrl(m));
}

module.exports = {
  PLATFORMS,
  MAX_URL_LENGTH,
  ERRORS,
  normalizePlatform,
  validateMeetingUrl,
  validateResourceUrl,
  maskMeetingUrl,
  maskUrlsInText,
};
