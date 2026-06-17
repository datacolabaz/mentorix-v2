/** İctimai səhifələr — frontend/public/sitemap.xml ilə uyğun */
const SITE_ORIGIN = 'https://mentorix.io';

const STATIC_SITEMAP_ENTRIES = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/login', changefreq: 'weekly', priority: '0.95' },
  { path: '/search', changefreq: 'daily', priority: '0.95' },
  { path: '/imtahanlar', changefreq: 'monthly', priority: '0.88' },
  { path: '/tapshiriqlar', changefreq: 'monthly', priority: '0.88' },
  { path: '/kurslar-ve-qruplar', changefreq: 'monthly', priority: '0.88' },
  { path: '/qiymetler', changefreq: 'monthly', priority: '0.9' },
  { path: '/muellimler-ucun', changefreq: 'monthly', priority: '0.92' },
  { path: '/telebeler-ucun', changefreq: 'monthly', priority: '0.85' },
  { path: '/haqqimizda', changefreq: 'monthly', priority: '0.8' },
  { path: '/elaqe', changefreq: 'monthly', priority: '0.8' },
  { path: '/repetitor-baki', changefreq: 'weekly', priority: '0.85' },
  { path: '/riyaziyyat-repetitoru', changefreq: 'weekly', priority: '0.8' },
  { path: '/ingilis-dili-repetitoru', changefreq: 'weekly', priority: '0.8' },
];

function formatSitemapDate(d) {
  if (!d) return new Date().toISOString().slice(0, 10);
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return new Date().toISOString().slice(0, 10);
  return dt.toISOString().slice(0, 10);
}

function escapeXml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildUrlEntry({ loc, lastmod, changefreq, priority }) {
  const parts = [
    '  <url>',
    `    <loc>${escapeXml(loc)}</loc>`,
    lastmod ? `    <lastmod>${escapeXml(lastmod)}</lastmod>` : '',
    changefreq ? `    <changefreq>${escapeXml(changefreq)}</changefreq>` : '',
    priority ? `    <priority>${escapeXml(priority)}</priority>` : '',
    '  </url>',
  ];
  return parts.filter(Boolean).join('\n');
}

function buildSitemapXml(urlEntries) {
  const body = urlEntries.map(buildUrlEntry).join('\n');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    body,
    '</urlset>',
  ].join('\n');
}

module.exports = {
  SITE_ORIGIN,
  STATIC_SITEMAP_ENTRIES,
  formatSitemapDate,
  buildSitemapXml,
};
