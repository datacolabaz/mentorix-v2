const db = require('../utils/db');
const { getCategorySubtreeIds } = require('../services/categoryService');
const {
  sqlPlanListingPriority,
  PUBLIC_DISCOVER_LISTING_SQL,
} = require('../services/mapListingPlanService');
const { notifyMarketplaceSearchOpportunity } = require('../services/marketplaceSearchOpportunityService');
const { enrichMapInstructorRows } = require('../services/instructorMapPreviewService');
const {
  BAKU,
  isBakuRegion,
  normalizeRegionName,
  resolveBakuDistrictsForSearch,
  isValidRegion,
  isValidBakuDistrict,
} = require('../lib/azerbaijanRegions');

function parseBoolQ(v) {
  if (v === true || v === 1 || v === '1' || v === 'true' || v === 'TRUE') return true;
  return false;
}

/**
 * GET /api/public/instructors-map
 * Query: region, baku_district, include_neighbors
 *        kind = all | teacher | trainer
 *        category_id, format, area_id — optional discovery filters
 */
const getInstructorsInMapView = async (req, res) => {
  try {
    const kind = String(req.query.kind || 'all').toLowerCase();
    const kindFilter = kind === 'teacher' || kind === 'trainer' ? kind : null;
    const categoryId = String(req.query.category_id || '').trim() || null;
    const format = String(req.query.format || 'any').toLowerCase();
    const areaId = String(req.query.area_id || '').trim() || null;

    const region = normalizeRegionName(req.query.region);
    const bakuDistrict = normalizeRegionName(req.query.baku_district);
    const includeNeighbors = parseBoolQ(req.query.include_neighbors);

    if (!region) {
      return res.status(400).json({
        success: false,
        message: 'region parametri tələb olunur',
      });
    }
    if (!isValidRegion(region)) {
      return res.status(400).json({
        success: false,
        message: 'Düzgün olmayan region',
      });
    }
    if (bakuDistrict && !isBakuRegion(region)) {
      return res.status(400).json({
        success: false,
        message: 'baku_district yalnız Bakı regionu üçün istifadə oluna bilər',
      });
    }
    if (bakuDistrict && !isValidBakuDistrict(bakuDistrict)) {
      return res.status(400).json({
        success: false,
        message: 'Düzgün olmayan Bakı rayonu',
      });
    }

    const params = [];
    let kindSql = '';
    if (kindFilter) {
      params.push(kindFilter);
      kindSql = ` AND ip.map_profile_kind = $${params.length}`;
    }

    let categorySql = '';
    if (categoryId) {
      const categoryIds = await getCategorySubtreeIds(categoryId);
      if (categoryIds.length) {
        params.push(categoryIds);
        categorySql = ` AND EXISTS (
          SELECT 1 FROM instructor_categories ic
          WHERE ic.user_id = u.id AND ic.category_id = ANY($${params.length}::varchar[])
        )`;
      }
    }

    let formatSql = '';
    if (['online', 'teacher_place', 'student_place'].includes(format)) {
      params.push(format);
      formatSql = ` AND EXISTS (
        SELECT 1 FROM instructor_delivery_formats df
        WHERE df.user_id = u.id AND df.format = $${params.length}::delivery_format
      )`;
    }

    let areaSql = '';
    if (areaId) {
      params.push(areaId);
      areaSql = ` AND EXISTS (
        SELECT 1 FROM instructor_service_areas isa
        WHERE isa.user_id = u.id AND isa.area_id = $${params.length}
      )`;
    }

    let regionSql = '';
    params.push(region);
    const regionP = params.length;
    regionSql = ` AND ip.region = $${regionP}`;

    let bakuDistrictSql = '';
    if (isBakuRegion(region) && bakuDistrict) {
      const districts = resolveBakuDistrictsForSearch(bakuDistrict, includeNeighbors);
      if (districts?.length) {
        params.push(districts);
        bakuDistrictSql = ` AND ip.baku_district = ANY($${params.length}::varchar[])`;
      }
    }

    const orderSql = `ORDER BY ${sqlPlanListingPriority()} ASC, u.full_name ASC`;

    const { rows } = await db.query(
      `SELECT
         u.id,
         u.full_name,
         COALESCE(NULLIF(TRIM(ip.subject), ''), '—') AS subject,
         ip.latitude::float8 AS latitude,
         ip.longitude::float8 AS longitude,
         ip.region,
         ip.baku_district,
         ip.region_user_set,
         ip.map_profile_kind,
         ip.avatar_url,
         COALESCE(s.plan, 'basic') AS plan,
         ${PUBLIC_DISCOVER_LISTING_SQL}
       FROM users u
       INNER JOIN instructor_profiles ip ON ip.user_id = u.id
       LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
       WHERE u.role = 'instructor'
         AND COALESCE(u.is_active, TRUE) = TRUE
         AND u.deleted_at IS NULL
         AND COALESCE(ip.map_visible, TRUE) = TRUE
         AND COALESCE(ip.region_user_set, FALSE) = TRUE
         AND ip.region IS NOT NULL
         ${regionSql}
         ${bakuDistrictSql}
         ${kindSql}
         ${categorySql}
         ${formatSql}
         ${areaSql}
       ${orderSql}
       LIMIT 200`,
      params,
    );

    const instructors = await enrichMapInstructorRows(rows);

    setImmediate(() => {
      notifyMarketplaceSearchOpportunity({
        categoryId,
        areaId,
        searchQ: null,
        region,
        bakuDistrict,
        includeNeighbors,
        kind: kindFilter || 'all',
        format,
      }).catch(() => {});
    });

    res.set('Cache-Control', 'public, max-age=30');
    res.json({
      success: true,
      instructors,
      meta: {
        region,
        baku_district: bakuDistrict || null,
        include_neighbors: includeNeighbors,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
};

module.exports = { getInstructorsInMapView, BAKU };
