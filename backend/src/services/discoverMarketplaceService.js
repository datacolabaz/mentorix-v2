const db = require('../utils/db');
const { normalizePlanSlug, planRank } = require('../config/plans');
const { getCategorySubtreeIds } = require('./categoryService');

const FREE_MAX_FORMATS = 1;
const FREE_MAX_AREAS = 1;
const FREE_MAX_CATEGORIES = 5;
const FREE_INQUIRY_CONTACTS_PER_MONTH = 2;

function isDiscoverPremium(planSlug) {
  return planRank(normalizePlanSlug(planSlug)) >= planRank('pro');
}

async function getInstructorPlanSlug(userId) {
  const { rows } = await db.query(
    `SELECT COALESCE(s.plan, 'basic') AS plan
     FROM users u
     LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
     WHERE u.id = $1 LIMIT 1`,
    [userId],
  );
  return normalizePlanSlug(rows[0]?.plan || 'basic');
}

function haversineKmSql(latParam, lngParam, latCol = 'ip.latitude', lngCol = 'ip.longitude') {
  return `(
    6371 * acos(
      LEAST(1, GREATEST(-1,
        cos(radians($${latParam})) * cos(radians(${latCol}::float8))
          * cos(radians(${lngCol}::float8) - radians($${lngParam}))
          + sin(radians($${latParam})) * sin(radians(${latCol}::float8))
      ))
    )
  )`;
}

async function searchDiscoverInstructors({
  categoryId,
  format,
  lat,
  lng,
  areaId,
  q,
  kind,
  limit = 50,
}) {
  const params = [];
  let i = 1;
  const where = [
    `u.role = 'instructor'`,
    `COALESCE(u.is_active, TRUE) = TRUE`,
    `u.deleted_at IS NULL`,
    `COALESCE(ip.map_visible, TRUE) = TRUE`,
    `ip.latitude IS NOT NULL`,
    `ip.longitude IS NOT NULL`,
  ];

  if (kind === 'teacher' || kind === 'trainer') {
    where.push(`ip.map_profile_kind = $${i++}`);
    params.push(kind);
  }

  let categoryIds = [];
  if (categoryId) {
    categoryIds = await getCategorySubtreeIds(categoryId);
    if (categoryIds.length) {
      where.push(`EXISTS (
        SELECT 1 FROM instructor_categories ic
        WHERE ic.user_id = u.id AND ic.category_id = ANY($${i++}::varchar[])
      )`);
      params.push(categoryIds);
    }
  }

  const searchQ = String(q || '').trim();
  if (searchQ.length >= 2) {
    where.push(`(
      u.full_name ILIKE $${i}
      OR COALESCE(ip.subject, '') ILIKE $${i}
      OR COALESCE(ip.discover_bio, '') ILIKE $${i}
    )`);
    params.push(`%${searchQ}%`);
    i++;
  }

  const fmt = String(format || 'any').toLowerCase();
  if (fmt !== 'any' && ['online', 'teacher_place', 'student_place'].includes(fmt)) {
    where.push(`EXISTS (
      SELECT 1 FROM instructor_delivery_formats df
      WHERE df.user_id = u.id AND df.format = $${i++}::delivery_format
    )`);
    params.push(fmt);
  }

  if (areaId) {
    where.push(`EXISTS (
      SELECT 1 FROM instructor_service_areas isa
      WHERE isa.user_id = u.id AND isa.area_id = $${i++}
    )`);
    params.push(areaId);
  }

  let distanceSql = 'NULL::float8 AS distance_km';
  let formatMatchSql = 'TRUE AS format_match';
  const hasCoords = lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));

  if (hasCoords) {
    params.push(Number(lat), Number(lng));
    const latP = i++;
    const lngP = i++;
    distanceSql = `${haversineKmSql(latP, lngP)}::float8 AS distance_km`;

    if (fmt === 'online') {
      formatMatchSql = `EXISTS (SELECT 1 FROM instructor_delivery_formats df WHERE df.user_id = u.id AND df.format = 'online')`;
    } else if (fmt === 'teacher_place') {
      formatMatchSql = `EXISTS (
        SELECT 1 FROM instructor_delivery_formats df
        WHERE df.user_id = u.id AND df.format = 'teacher_place'
      ) AND ${haversineKmSql(latP, lngP)} <= COALESCE(ip.map_search_radius_km, 15)`;
    } else if (fmt === 'student_place') {
      formatMatchSql = `EXISTS (
        SELECT 1 FROM instructor_delivery_formats df
        WHERE df.user_id = u.id AND df.format = 'student_place'
          AND ${haversineKmSql(latP, lngP)} <= df.travel_radius_km
      )`;
    } else if (fmt === 'any') {
      formatMatchSql = `(
        EXISTS (SELECT 1 FROM instructor_delivery_formats df WHERE df.user_id = u.id AND df.format = 'online')
        OR EXISTS (
          SELECT 1 FROM instructor_delivery_formats df
          WHERE df.user_id = u.id AND df.format = 'teacher_place'
            AND ${haversineKmSql(latP, lngP)} <= COALESCE(ip.map_search_radius_km, 15)
        )
        OR EXISTS (
          SELECT 1 FROM instructor_delivery_formats df
          WHERE df.user_id = u.id AND df.format = 'student_place'
            AND ${haversineKmSql(latP, lngP)} <= df.travel_radius_km
        )
      )`;
    }
    where.push(formatMatchSql);
  }

  params.push(Math.min(100, Math.max(1, limit)));
  const limitP = i;

  const { rows } = await db.query(
    `SELECT
       u.id,
       u.full_name,
       COALESCE(NULLIF(TRIM(ip.subject), ''), '—') AS subject,
       ip.latitude::float8 AS latitude,
       ip.longitude::float8 AS longitude,
       ip.map_profile_kind,
       ip.discover_hourly_rate,
       ip.discover_bio,
       ip.discover_verified,
       ip.teacher_place_address,
       COALESCE(s.plan, 'basic') AS plan,
       ${distanceSql},
       (
         SELECT COALESCE(json_agg(json_build_object('format', df.format, 'travel_radius_km', df.travel_radius_km) ORDER BY df.format), '[]'::json)
         FROM instructor_delivery_formats df WHERE df.user_id = u.id
       ) AS delivery_formats,
       (
         SELECT COALESCE(json_agg(c.name_az ORDER BY c.name_az), '[]'::json)
         FROM instructor_categories ic
         INNER JOIN categories c ON c.id = ic.category_id
         WHERE ic.user_id = u.id
         LIMIT 5
       ) AS category_names
     FROM users u
     INNER JOIN instructor_profiles ip ON ip.user_id = u.id
     LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
     WHERE ${where.join(' AND ')}
     ORDER BY
       CASE WHEN COALESCE(s.plan, 'basic') IN ('premium', 'growth') THEN 0
            WHEN COALESCE(s.plan, 'basic') = 'pro' THEN 1
            ELSE 2 END ASC,
       ip.discover_verified DESC,
       distance_km ASC NULLS LAST,
       u.full_name ASC
     LIMIT $${limitP}`,
    params,
  );

  return rows.map((r) => ({
    ...r,
    is_premium_listing: ['pro', 'growth', 'premium'].includes(normalizePlanSlug(r.plan)),
    delivery_formats: Array.isArray(r.delivery_formats) ? r.delivery_formats : [],
    category_names: Array.isArray(r.category_names) ? r.category_names : [],
  }));
}

async function getInstructorDiscoverProfile(userId) {
  const plan = await getInstructorPlanSlug(userId);
  const premium = isDiscoverPremium(plan);

  const { rows: prof } = await db.query(
    `SELECT latitude, longitude, map_profile_kind, map_visible, subject,
            discover_hourly_rate, discover_bio, discover_verified, teacher_place_address,
            map_search_radius_km
     FROM instructor_profiles WHERE user_id = $1 LIMIT 1`,
    [userId],
  );
  const { rows: cats } = await db.query(
    `SELECT ic.category_id AS id, c.name_az, c.slug
     FROM instructor_categories ic
     INNER JOIN categories c ON c.id = ic.category_id
     WHERE ic.user_id = $1 ORDER BY c.name_az`,
    [userId],
  );
  const { rows: formats } = await db.query(
    `SELECT format, travel_radius_km FROM instructor_delivery_formats WHERE user_id = $1 ORDER BY format`,
    [userId],
  );
  const { rows: areas } = await db.query(
    `SELECT isa.area_id AS id, sa.name_az, sa.kind, sa.slug
     FROM instructor_service_areas isa
     INNER JOIN service_areas sa ON sa.id = isa.area_id
     WHERE isa.user_id = $1 ORDER BY sa.sort_order, sa.name_az`,
    [userId],
  );

  return {
    plan,
    premium,
    limits: {
      max_formats: premium ? null : FREE_MAX_FORMATS,
      max_areas: premium ? null : FREE_MAX_AREAS,
      max_categories: premium ? null : FREE_MAX_CATEGORIES,
      inquiry_contacts_per_month: premium ? null : FREE_INQUIRY_CONTACTS_PER_MONTH,
    },
    profile: prof[0] || null,
    categories: cats,
    delivery_formats: formats,
    service_areas: areas,
  };
}

function enforceDiscoverLimits(premium, body) {
  const cats = Array.isArray(body.category_ids) ? body.category_ids : null;
  const formats = Array.isArray(body.delivery_formats) ? body.delivery_formats : null;
  const areas = Array.isArray(body.service_area_ids) ? body.service_area_ids : null;
  if (!premium) {
    if (cats && cats.length > FREE_MAX_CATEGORIES) {
      return `Pulsuz paketdə ən çox ${FREE_MAX_CATEGORIES} fənn seçə bilərsiniz`;
    }
    if (formats && formats.length > FREE_MAX_FORMATS) {
      return `Pulsuz paketdə yalnız 1 dərs formatı aktiv edə bilərsiniz`;
    }
    if (areas && areas.length > FREE_MAX_AREAS) {
      return `Pulsuz paketdə yalnız 1 rayon/metro seçə bilərsiniz`;
    }
  }
  return null;
}

async function upsertInstructorDiscoverProfile(userId, body) {
  const plan = await getInstructorPlanSlug(userId);
  const premium = isDiscoverPremium(plan);
  const limitErr = enforceDiscoverLimits(premium, body);
  if (limitErr) {
    const err = new Error(limitErr);
    err.status = 403;
    throw err;
  }

  const sets = [];
  const vals = [];
  let pi = 1;

  if (body.discover_hourly_rate !== undefined) {
    const rate = body.discover_hourly_rate === null || body.discover_hourly_rate === ''
      ? null
      : Number.parseFloat(body.discover_hourly_rate);
    sets.push(`discover_hourly_rate = $${pi++}`);
    vals.push(Number.isFinite(rate) ? rate : null);
  }
  if (body.discover_bio !== undefined) {
    sets.push(`discover_bio = $${pi++}`);
    vals.push(body.discover_bio == null ? null : String(body.discover_bio).slice(0, 2000));
  }
  if (body.teacher_place_address !== undefined) {
    sets.push(`teacher_place_address = $${pi++}`);
    vals.push(body.teacher_place_address == null ? null : String(body.teacher_place_address).slice(0, 500));
  }
  if (body.map_search_radius_km !== undefined) {
    const r = Number.parseInt(body.map_search_radius_km, 10);
    sets.push(`map_search_radius_km = $${pi++}`);
    vals.push(Number.isFinite(r) ? Math.min(200, Math.max(1, r)) : 10);
  }

  if (sets.length) {
    vals.push(userId);
    await db.query(`UPDATE instructor_profiles SET ${sets.join(', ')} WHERE user_id = $${pi}`, vals);
  }

  if (Array.isArray(body.category_ids)) {
    await db.query('DELETE FROM instructor_categories WHERE user_id = $1', [userId]);
    const ids = [...new Set(body.category_ids.map(String).filter(Boolean))].slice(0, premium ? 50 : FREE_MAX_CATEGORIES);
    for (const cid of ids) {
      await db.query(
        `INSERT INTO instructor_categories (user_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [userId, cid],
      );
    }
  }

  if (Array.isArray(body.delivery_formats)) {
    await db.query('DELETE FROM instructor_delivery_formats WHERE user_id = $1', [userId]);
    const allowed = ['online', 'teacher_place', 'student_place'];
    const list = body.delivery_formats
      .filter((f) => f && allowed.includes(String(f.format || f).toLowerCase()))
      .slice(0, premium ? 3 : FREE_MAX_FORMATS);
    for (const f of list) {
      const format = String(f.format || f).toLowerCase();
      let travel = Number.parseInt(f.travel_radius_km, 10);
      if (!Number.isFinite(travel)) travel = 10;
      await db.query(
        `INSERT INTO instructor_delivery_formats (user_id, format, travel_radius_km) VALUES ($1, $2::delivery_format, $3)`,
        [userId, format, Math.min(200, Math.max(1, travel))],
      );
    }
  }

  if (Array.isArray(body.service_area_ids)) {
    await db.query('DELETE FROM instructor_service_areas WHERE user_id = $1', [userId]);
    const ids = [...new Set(body.service_area_ids.map(String).filter(Boolean))].slice(
      0,
      premium ? 100 : FREE_MAX_AREAS,
    );
    for (const aid of ids) {
      await db.query(
        `INSERT INTO instructor_service_areas (user_id, area_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [userId, aid],
      );
    }
  }

  return getInstructorDiscoverProfile(userId);
}

async function listServiceAreas() {
  const { rows } = await db.query(
    `SELECT id, slug, name_az, kind, is_popular, sort_order
     FROM service_areas
     ORDER BY is_popular DESC, sort_order ASC, name_az ASC`,
  );
  return rows;
}

async function countInquiryContactsViewedThisMonth(userId) {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS c FROM student_inquiries
     WHERE instructor_user_id = $1
       AND contact_revealed_at IS NOT NULL
       AND contact_revealed_at >= date_trunc('month', CURRENT_TIMESTAMP)`,
    [userId],
  );
  return rows[0]?.c || 0;
}

module.exports = {
  FREE_MAX_FORMATS,
  FREE_MAX_AREAS,
  FREE_INQUIRY_CONTACTS_PER_MONTH,
  isDiscoverPremium,
  searchDiscoverInstructors,
  getInstructorDiscoverProfile,
  upsertInstructorDiscoverProfile,
  listServiceAreas,
  countInquiryContactsViewedThisMonth,
  getInstructorPlanSlug,
};
