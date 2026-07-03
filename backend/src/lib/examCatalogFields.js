const VALID_LEVELS = new Set(['beginner', 'intermediate', 'advanced', 'professional']);
const VALID_CERT_TYPES = new Set(['preparation', 'professional', 'fundamentals']);

function parseCatalogFields(body) {
  const publicProvided = Object.prototype.hasOwnProperty.call(body || {}, 'is_public');
  const categoryIdProvided = Object.prototype.hasOwnProperty.call(body || {}, 'category_id');
  const levelProvided = Object.prototype.hasOwnProperty.call(body || {}, 'level');
  const certTypeProvided = Object.prototype.hasOwnProperty.call(body || {}, 'certificate_type');

  const isPublic = publicProvided
    ? body.is_public === true || body.is_public === 'true' || body.is_public === 1
    : undefined;

  let category_id = undefined;
  if (categoryIdProvided) {
    const raw = String(body.category_id || '').trim();
    category_id = raw || null;
  }

  let level = undefined;
  if (levelProvided) {
    const l = String(body.level || '').trim().toLowerCase();
    level = VALID_LEVELS.has(l) ? l : 'beginner';
  }

  let certificate_type = undefined;
  if (certTypeProvided) {
    const t = String(body.certificate_type || '').trim().toLowerCase();
    certificate_type = VALID_CERT_TYPES.has(t) ? t : 'professional';
  }

  return {
    publicProvided,
    categoryIdProvided,
    levelProvided,
    certTypeProvided,
    is_public: isPublic,
    category_id,
    level,
    certificate_type,
  };
}

module.exports = { parseCatalogFields, VALID_LEVELS, VALID_CERT_TYPES };
