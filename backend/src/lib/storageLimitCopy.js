/**
 * Localized "storage limit reached" upload error (az/en/ru).
 * Reaching the limit only blocks NEW uploads — files already stored (even above the cap) are kept.
 * On the top plan (Premium, 50 GB) there is nothing to upgrade to, so the copy points to deleting
 * old files or contacting support; lower plans also mention upgrading.
 */
const { normalizeLocale, localeFromReq } = require('./userLocale');

const TOP_PLAN_SLUG = 'premium';

function formatStorageBytes(bytes) {
  const n = Math.max(0, Number(bytes) || 0);
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(n >= 10 * 1024 ** 3 ? 0 : 1)} GB`;
  if (n >= 1024 ** 2) return `${Math.round(n / 1024 ** 2)} MB`;
  return `${Math.round(n / 1024)} KB`;
}

const COPY = {
  az: {
    full: (u) => (u ? `Yaddaş limitinə çatdınız (${u}).` : 'Yaddaş limitinə çatdınız.'),
    kept: 'Mövcud fayllarınız silinmir.',
    deleteOrSupport: (p) =>
      `Yeni fayl yükləmək üçün köhnə faylları silin və ya dəstək ilə əlaqə saxlayın${p ? ` (${p})` : ''}.`,
    upgrade: 'Daha geniş paketə də keçə bilərsiniz.',
  },
  en: {
    full: (u) => (u ? `You have reached your storage limit (${u}).` : 'You have reached your storage limit.'),
    kept: 'Your existing files are kept.',
    deleteOrSupport: (p) => `To upload new files, delete old files or contact support${p ? ` (${p})` : ''}.`,
    upgrade: 'You can also upgrade to a larger plan.',
  },
  ru: {
    full: (u) => (u ? `Достигнут лимит хранилища (${u}).` : 'Достигнут лимит хранилища.'),
    kept: 'Существующие файлы сохраняются.',
    deleteOrSupport: (p) =>
      `Чтобы загрузить новые файлы, удалите старые или свяжитесь с поддержкой${p ? ` (${p})` : ''}.`,
    upgrade: 'Также можно перейти на тариф с большим объёмом.',
  },
};

function pickCopy(locale) {
  const l = normalizeLocale(locale);
  return COPY[l] || COPY.az;
}

/**
 * @param {{ locale?: string, planSlug?: string, usedBytes?: number, limitBytes?: number, supportPhone?: string }} o
 */
function storageLimitMessage({ locale, planSlug, usedBytes, limitBytes, supportPhone } = {}) {
  const c = pickCopy(locale);
  const usage =
    limitBytes != null && Number(limitBytes) > 0
      ? `${formatStorageBytes(usedBytes)} / ${formatStorageBytes(limitBytes)}`
      : '';
  const parts = [c.full(usage), c.kept, c.deleteOrSupport(String(supportPhone || '').trim())];
  if (String(planSlug || '').toLowerCase() !== TOP_PLAN_SLUG) parts.push(c.upgrade);
  return parts.join(' ');
}

async function supportPhoneDisplay() {
  try {
    const { getPublicPlatformContact } = require('../services/platformContactService');
    const contact = await getPublicPlatformContact();
    return contact?.phone_display || '';
  } catch {
    return '';
  }
}

/** Request-aware variant: locale from the request, support phone from the platform contact setting. */
async function storageLimitMessageForRequest(req, { planSlug, usedBytes, limitBytes } = {}) {
  return storageLimitMessage({
    locale: localeFromReq(req),
    planSlug,
    usedBytes,
    limitBytes,
    supportPhone: await supportPhoneDisplay(),
  });
}

module.exports = {
  TOP_PLAN_SLUG,
  formatStorageBytes,
  storageLimitMessage,
  storageLimitMessageForRequest,
  supportPhoneDisplay,
};
