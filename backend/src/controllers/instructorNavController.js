const db = require('../utils/db');
const {
  INSTRUCTOR_NAV_SLUG,
  deepClone,
  defaultInstructorNavPayload,
  normalizePutPayload,
  mergeInstructorNavFromDb,
  serializeNavForClient,
  INSTRUCTOR_NAV_ITEM_DEFS,
  ALL_ITEM_KEYS,
} = require('../constants/defaultInstructorNav');

async function loadRawPayload() {
  const { rows } = await db.query(
    `SELECT payload, updated_at FROM site_marketing_configs WHERE slug = $1`,
    [INSTRUCTOR_NAV_SLUG],
  );
  if (!rows.length) return { payload: {}, updated_at: null };
  return { payload: rows[0].payload || {}, updated_at: rows[0].updated_at };
}

async function loadInstructorNavForClient() {
  const { payload, updated_at } = await loadRawPayload();
  return { nav: serializeNavForClient(payload), updated_at };
}

const getPublicInstructorNav = async (req, res) => {
  try {
    const { nav, updated_at } = await loadInstructorNavForClient();
    res.set('Cache-Control', 'no-store, max-age=0');
    res.json({ success: true, slug: INSTRUCTOR_NAV_SLUG, nav, updated_at });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
};

const getInstructorNavSections = async (req, res) => {
  try {
    const { nav, updated_at } = await loadInstructorNavForClient();
    res.set('Cache-Control', 'no-store, max-age=0');
    res.json({ success: true, slug: INSTRUCTOR_NAV_SLUG, nav, updated_at });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
};

const getAdminInstructorNav = async (req, res) => {
  try {
    const { payload, updated_at } = await loadRawPayload();
    const merged = mergeInstructorNavFromDb(payload);
    const defaults = deepClone(defaultInstructorNavPayload());
    res.json({
      success: true,
      slug: INSTRUCTOR_NAV_SLUG,
      nav: merged,
      defaults,
      item_defs: INSTRUCTOR_NAV_ITEM_DEFS,
      all_item_keys: ALL_ITEM_KEYS,
      updated_at,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
};

const putAdminInstructorNav = async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const incoming = body.nav != null ? body.nav : body;
    const normalized = normalizePutPayload(incoming);

    await db.query(
      `INSERT INTO site_marketing_configs (slug, payload, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (slug) DO UPDATE SET
         payload = EXCLUDED.payload,
         updated_at = NOW()`,
      [INSTRUCTOR_NAV_SLUG, JSON.stringify(normalized)],
    );

    res.json({
      success: true,
      slug: INSTRUCTOR_NAV_SLUG,
      nav: normalized,
      client: serializeNavForClient(normalized),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
};

module.exports = {
  getPublicInstructorNav,
  getInstructorNavSections,
  getAdminInstructorNav,
  putAdminInstructorNav,
};
