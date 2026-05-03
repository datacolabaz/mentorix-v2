const db = require('../utils/db');
const {
  LOGIN_MARKETING_SLUG,
  mergeLoginMarketingFromDb,
  normalizePutPayload,
  deepClone,
  defaultLoginMarketingPayload,
} = require('../constants/defaultLoginMarketing');

async function loadRawPayload() {
  const { rows } = await db.query(
    `SELECT payload, updated_at FROM site_marketing_configs WHERE slug = $1`,
    [LOGIN_MARKETING_SLUG],
  );
  if (!rows.length) return { payload: {}, updated_at: null };
  return { payload: rows[0].payload || {}, updated_at: rows[0].updated_at };
}

const getPublicLoginMarketing = async (req, res) => {
  try {
    const { payload } = await loadRawPayload();
    const merged = mergeLoginMarketingFromDb(payload);
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
    res.json({ success: true, slug: LOGIN_MARKETING_SLUG, landing: merged });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
};

const getAdminLoginMarketing = async (req, res) => {
  try {
    const { payload, updated_at } = await loadRawPayload();
    const merged = mergeLoginMarketingFromDb(payload);
    const defaults = deepClone(defaultLoginMarketingPayload());
    res.json({
      success: true,
      slug: LOGIN_MARKETING_SLUG,
      landing: merged,
      defaults,
      updated_at,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
};

const putAdminLoginMarketing = async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const incoming = body.landing != null ? body.landing : body;
    const normalized = normalizePutPayload(incoming);

    await db.query(
      `INSERT INTO site_marketing_configs (slug, payload, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (slug) DO UPDATE SET
         payload = EXCLUDED.payload,
         updated_at = NOW()`,
      [LOGIN_MARKETING_SLUG, JSON.stringify(normalized)],
    );

    res.json({ success: true, slug: LOGIN_MARKETING_SLUG, landing: normalized });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
};

module.exports = {
  getPublicLoginMarketing,
  getAdminLoginMarketing,
  putAdminLoginMarketing,
};
