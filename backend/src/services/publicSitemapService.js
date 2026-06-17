const db = require('../utils/db');
const {
  SITE_ORIGIN,
  STATIC_SITEMAP_ENTRIES,
  formatSitemapDate,
  buildSitemapXml,
} = require('../constants/publicSitemapUrls');

async function listPublicTeacherSitemapRows() {
  const { rows } = await db.query(
    `SELECT u.id,
            COALESCE(u.updated_at, u.created_at) AS updated_at
     FROM users u
     INNER JOIN instructor_profiles ip ON ip.user_id = u.id
     WHERE u.role = 'instructor'
       AND COALESCE(u.is_active, TRUE) = TRUE
       AND u.deleted_at IS NULL
       AND COALESCE(ip.map_visible, TRUE) = TRUE
     ORDER BY u.full_name ASC NULLS LAST, u.id ASC`,
  );
  return rows || [];
}

async function buildPublicSitemapXml() {
  const defaultLastmod = formatSitemapDate(new Date());
  const staticEntries = STATIC_SITEMAP_ENTRIES.map((entry) => ({
    loc: `${SITE_ORIGIN}${entry.path}`,
    lastmod: defaultLastmod,
    changefreq: entry.changefreq,
    priority: entry.priority,
  }));

  const teachers = await listPublicTeacherSitemapRows();
  const teacherEntries = teachers.map((row) => ({
    loc: `${SITE_ORIGIN}/teachers/${row.id}`,
    lastmod: formatSitemapDate(row.updated_at),
    changefreq: 'weekly',
    priority: '0.7',
  }));

  return buildSitemapXml([...staticEntries, ...teacherEntries]);
}

module.exports = {
  buildPublicSitemapXml,
  listPublicTeacherSitemapRows,
};
