const { runMarketplaceAiSearch } = require('../services/marketplaceAiSearchService');

function parseFloatQ(v) {
  const n = Number.parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** POST /api/public/marketplace/ai-search */
const postMarketplaceAiSearch = async (req, res) => {
  try {
    const query = String(req.body?.query || '').trim();
    const forChild = Boolean(req.body?.for_child);
    const lat = parseFloatQ(req.body?.lat);
    const lng = parseFloatQ(req.body?.lng);

    const result = await runMarketplaceAiSearch({
      query,
      forChild,
      lat,
      lng,
      limit: 3,
    });

    res.json({ success: true, ...result });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ success: false, message: err.message || 'Xəta' });
  }
};

module.exports = { postMarketplaceAiSearch };
