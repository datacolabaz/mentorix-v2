const db = require('../utils/db');
const {
  buildCategoryTree,
  toPublicCategoryNode,
  flattenTeachingCategories,
  TEACHING_CATEGORY_TREE,
} = require('../data/teachingCategories');

async function ensureCategoriesSeeded() {
  const { rows } = await db.query('SELECT COUNT(*)::int AS c FROM categories');
  if (rows[0]?.c > 0) return false;
  const flat = flattenTeachingCategories();
  for (const r of flat) {
    await db.query(
      `INSERT INTO categories (id, parent_id, slug, name_az, icon, is_popular, is_virtual_category, target_category_id, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO NOTHING`,
      [
        r.id,
        r.parent_id,
        r.slug,
        r.name_az,
        r.icon,
        r.is_popular,
        r.is_virtual_category,
        r.target_category_id,
        r.sort_order,
      ],
    );
  }
  return true;
}

async function listCategoryRows() {
  await ensureCategoriesSeeded();
  const { rows } = await db.query(
    `SELECT id, parent_id, slug, name_az, icon, is_popular, is_virtual_category, target_category_id, sort_order
     FROM categories
     ORDER BY sort_order ASC, name_az ASC`,
  );
  return rows;
}

async function getCategoryTree() {
  const rows = await listCategoryRows();
  const tree = buildCategoryTree(rows);
  return tree.map(toPublicCategoryNode);
}

async function getCategoryBySlug(slug) {
  const s = String(slug || '').trim();
  if (!s) return null;
  await ensureCategoriesSeeded();
  const { rows } = await db.query(
    `SELECT id, parent_id, slug, name_az, search_aliases, icon, is_popular, is_virtual_category, target_category_id
     FROM categories WHERE slug = $1 LIMIT 1`,
    [s],
  );
  return rows[0] || null;
}

async function getCategoryById(id) {
  const { rows } = await db.query(
    `SELECT id, parent_id, slug, name_az, search_aliases, icon, is_popular, is_virtual_category, target_category_id
     FROM categories WHERE id = $1 LIMIT 1`,
    [id],
  );
  return rows[0] || null;
}

/** All category ids in subtree (inclusive) for filter matching */
async function getCategorySubtreeIds(rootId) {
  const cat = await getCategoryById(rootId);
  if (!cat) return [];
  if (cat.target_category_id) {
    return getCategorySubtreeIds(cat.target_category_id);
  }
  const { rows } = await db.query(
    `WITH RECURSIVE subtree AS (
       SELECT id FROM categories WHERE id = $1
       UNION ALL
       SELECT c.id FROM categories c
       INNER JOIN subtree s ON c.parent_id = s.id
     )
     SELECT id FROM subtree`,
    [rootId],
  );
  return rows.map((r) => r.id);
}

async function searchCategories(query, limit = 20) {
  const q = String(query || '').trim();
  if (!q || q.length < 2) return [];
  await ensureCategoriesSeeded();
  const { rows } = await db.query(
    `SELECT id, parent_id, slug, name_az, search_aliases, is_popular, is_virtual_category, target_category_id
     FROM categories
     WHERE is_virtual_category = FALSE
       AND (
         name_az ILIKE $1
         OR slug ILIKE $1
         OR id ILIKE $1
         OR COALESCE(search_aliases, '') ILIKE $1
       )
     ORDER BY is_popular DESC, name_az ASC
     LIMIT $2`,
    [`%${q}%`, Math.min(50, Math.max(1, limit))],
  );
  return rows;
}

async function listAllCategoriesFlat() {
  await ensureCategoriesSeeded();
  const { rows } = await db.query(
    `SELECT c.id, c.parent_id, c.slug, c.name_az, c.search_aliases, c.is_popular, c.is_virtual_category,
            c.sort_order, p.name_az AS parent_name_az
     FROM categories c
     LEFT JOIN categories p ON p.id = c.parent_id
     ORDER BY c.is_virtual_category ASC, c.sort_order ASC, c.name_az ASC`,
  );
  return rows;
}

async function updateCategoryAdmin(id, { name_az, search_aliases, is_popular }) {
  const cat = await getCategoryById(id);
  if (!cat) {
    const err = new Error('Kateqoriya tapılmadı');
    err.statusCode = 404;
    throw err;
  }
  const sets = [];
  const vals = [];
  let i = 1;
  if (name_az !== undefined) {
    const name = String(name_az || '').trim();
    if (!name || name.length > 255) {
      const err = new Error('Ad tələb olunur (max 255 simvol)');
      err.statusCode = 400;
      throw err;
    }
    sets.push(`name_az = $${i++}`);
    vals.push(name);
  }
  if (search_aliases !== undefined) {
    const aliases = String(search_aliases || '')
      .trim()
      .slice(0, 2000);
    sets.push(`search_aliases = $${i++}`);
    vals.push(aliases || null);
  }
  if (is_popular !== undefined) {
    sets.push(`is_popular = $${i++}`);
    vals.push(Boolean(is_popular));
  }
  if (!sets.length) return getCategoryById(id);
  vals.push(id);
  await db.query(`UPDATE categories SET ${sets.join(', ')} WHERE id = $${i}`, vals);
  return getCategoryById(id);
}

async function listPopularLeaves(limit = 12) {
  await ensureCategoriesSeeded();
  const { rows } = await db.query(
    `SELECT c.id, c.slug, c.name_az, c.is_popular, p.name_az AS parent_name_az
     FROM categories c
     LEFT JOIN categories p ON p.id = c.parent_id
     WHERE c.is_popular = TRUE
       AND c.is_virtual_category = FALSE
       AND c.slug IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM categories ch WHERE ch.parent_id = c.id)
     ORDER BY c.sort_order ASC, c.name_az ASC
     LIMIT $1`,
    [Math.min(30, Math.max(1, limit))],
  );
  return rows;
}

module.exports = {
  TEACHING_CATEGORY_TREE,
  ensureCategoriesSeeded,
  getCategoryTree,
  getCategoryBySlug,
  getCategoryById,
  getCategorySubtreeIds,
  searchCategories,
  listAllCategoriesFlat,
  updateCategoryAdmin,
  listPopularLeaves,
};
