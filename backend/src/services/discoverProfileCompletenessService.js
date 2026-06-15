const db = require('../utils/db');

/**
 * Axtarışda görünmək üçün minimum profil tamlığı.
 */
async function getDiscoverProfileCompleteness(userId) {
  const { rows: profRows } = await db.query(
    `SELECT ip.subject,
            ip.latitude,
            ip.longitude,
            COALESCE(ip.map_visible, TRUE) AS map_visible
     FROM instructor_profiles ip
     WHERE ip.user_id = $1
     LIMIT 1`,
    [userId],
  );
  const prof = profRows[0] || null;

  const { rows: catRows } = await db.query(
    `SELECT COUNT(*)::int AS n FROM instructor_categories WHERE user_id = $1`,
    [userId],
  );
  const categoriesCount = Number(catRows[0]?.n || 0);

  const { rows: fmtRows } = await db.query(
    `SELECT COUNT(*)::int AS n FROM instructor_delivery_formats WHERE user_id = $1`,
    [userId],
  );
  const formatsCount = Number(fmtRows[0]?.n || 0);

  const hasCategories = categoriesCount > 0;
  const hasMapPin = prof?.latitude != null && prof?.longitude != null;
  const hasFormats = formatsCount > 0;
  const mapVisible = prof?.map_visible !== false;

  const missing = [];
  if (!hasCategories) missing.push('categories');
  if (!hasMapPin) missing.push('map_pin');
  if (!hasFormats) missing.push('delivery_formats');

  const searchable = hasCategories && mapVisible && (hasMapPin || hasFormats);

  return {
    complete: searchable,
    searchable,
    missing,
    categories_count: categoriesCount,
    formats_count: formatsCount,
    has_map_pin: hasMapPin,
    map_visible: mapVisible,
    subject: prof?.subject || null,
  };
}

function buildDiscoverProfileAlert(completeness) {
  if (!completeness || completeness.searchable) return null;

  const parts = [];
  if (completeness.missing.includes('categories')) {
    parts.push('tədris etdiyiniz fənnləri');
  }
  if (completeness.missing.includes('map_pin')) {
    parts.push('xəritə pinini');
  }
  if (completeness.missing.includes('delivery_formats')) {
    parts.push('dərs formatını');
  }

  const focus =
    completeness.missing[0] === 'categories'
      ? 'Sizi axtarışda daha asan tapmaq üçün tədris etdiyiniz fənnləri profilinizə daxil edin.'
      : 'Axtarış profiliniz tam deyil — valideynlər sizi tapa bilməyə bilər.';

  const detail =
    parts.length > 0
      ? `${focus} Tənzimləmələrdə ${parts.join(', ')} doldurun.`
      : focus;

  return {
    type: 'discover_profile',
    level: completeness.missing.includes('categories') ? 'warning' : 'warning',
    message: detail,
    cta: {
      label: completeness.missing.includes('categories') ? 'Fənn əlavə et' : 'Axtarış profilini tamamla',
      action: 'OPEN_DISCOVER_PROFILE',
    },
  };
}

module.exports = {
  getDiscoverProfileCompleteness,
  buildDiscoverProfileAlert,
};
