const {
  getCategoryTree,
  getCategoryBySlug,
  searchCategories,
  listPopularLeaves,
} = require('../services/categoryService');
const { listServiceAreas } = require('../services/discoverMarketplaceService');

const getCategoriesTree = async (_req, res) => {
  try {
    const tree = await getCategoryTree();
    res.set('Cache-Control', 'public, max-age=300');
    res.json({ success: true, categories: tree });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
};

const getCategoriesSearch = async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const limit = Number.parseInt(req.query.limit, 10) || 20;
    const results = await searchCategories(q, limit);
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
};

const getCategoryBySlugHandler = async (req, res) => {
  try {
    const cat = await getCategoryBySlug(req.params.slug);
    if (!cat) return res.status(404).json({ success: false, message: 'Kateqoriya tapılmadı' });
    res.json({ success: true, category: cat });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
};

const getPopularCategories = async (_req, res) => {
  try {
    const popular = await listPopularLeaves(16);
    res.set('Cache-Control', 'public, max-age=300');
    res.json({ success: true, popular });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
};

const getServiceAreas = async (_req, res) => {
  try {
    const areas = await listServiceAreas();
    res.set('Cache-Control', 'public, max-age=600');
    res.json({ success: true, areas });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
};

module.exports = {
  getCategoriesTree,
  getCategoriesSearch,
  getCategoryBySlugHandler,
  getPopularCategories,
  getServiceAreas,
};
