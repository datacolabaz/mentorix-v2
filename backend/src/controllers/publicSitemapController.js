const { buildPublicSitemapXml } = require('../services/publicSitemapService');

const getPublicSitemapXml = async (req, res) => {
  try {
    const xml = await buildPublicSitemapXml();
    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    res.send(xml);
  } catch (err) {
    res.status(500).type('text/plain').send(err.message || 'Sitemap yaradılmadı');
  }
};

module.exports = { getPublicSitemapXml };
