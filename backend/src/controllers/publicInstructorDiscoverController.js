const { searchDiscoverInstructors } = require('../services/discoverMarketplaceService');
const { getCategoryBySlug, getCategoryById } = require('../services/categoryService');

function parseFloatQ(v) {
  const n = Number.parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/**
 * GET /api/public/instructor-discovery
 * Query: category_id | category_slug, format=any|online|teacher_place|student_place,
 *        lat, lng, area_id, q, kind, limit
 */
const getInstructorDiscovery = async (req, res) => {
  try {
    let categoryId = String(req.query.category_id || '').trim() || null;
    const categorySlug = String(req.query.category_slug || '').trim();
    if (!categoryId && categorySlug) {
      const cat = await getCategoryBySlug(categorySlug);
      if (cat) categoryId = cat.id;
    }
    if (categoryId) {
      const exists = await getCategoryById(categoryId);
      if (!exists) categoryId = null;
    }

    const instructors = await searchDiscoverInstructors({
      categoryId,
      format: req.query.format || 'any',
      lat: parseFloatQ(req.query.lat),
      lng: parseFloatQ(req.query.lng),
      areaId: String(req.query.area_id || '').trim() || null,
      q: req.query.q,
      kind: String(req.query.kind || 'all').toLowerCase(),
      limit: Number.parseInt(req.query.limit, 10) || 50,
    });

    res.set('Cache-Control', 'public, max-age=30');
    res.json({ success: true, instructors });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
};

module.exports = { getInstructorDiscovery };
