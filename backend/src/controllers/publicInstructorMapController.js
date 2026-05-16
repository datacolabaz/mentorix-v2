const db = require('../utils/db');

function parseFloatQ(v) {
  const n = Number.parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

/**
 * GET /api/public/instructors-map
 * Query: north, south, east, west (WGS84) OR lat, lng, radius_km (center + radius)
 *        kind = all | teacher | trainer
 */
const getInstructorsInMapView = async (req, res) => {
  try {
    const kind = String(req.query.kind || 'all').toLowerCase();
    const kindFilter = kind === 'teacher' || kind === 'trainer' ? kind : null;

    const lat = parseFloatQ(req.query.lat);
    const lng = parseFloatQ(req.query.lng);
    const radiusKm = parseFloatQ(req.query.radius_km);

    const north = parseFloatQ(req.query.north);
    const south = parseFloatQ(req.query.south);
    const east = parseFloatQ(req.query.east);
    const west = parseFloatQ(req.query.west);

    let n = north;
    let s = south;
    let e = east;
    let w = west;
    let hasBounds = false;

    if (lat != null && lng != null && radiusKm != null && radiusKm > 0 && radiusKm <= 200) {
      const r = clamp(radiusKm, 0.5, 200);
      const latDelta = r / 111;
      const cosLat = Math.cos((lat * Math.PI) / 180) || 1e-6;
      const lngDelta = r / (111 * cosLat);
      n = clamp(lat + latDelta, -85, 85);
      s = clamp(lat - latDelta, -85, 85);
      e = clamp(lng + lngDelta, -180, 180);
      w = clamp(lng - lngDelta, -180, 180);
      hasBounds = true;
    } else if (north != null && south != null && east != null && west != null) {
      if (south >= north) {
        return res.status(400).json({ success: false, message: 'south < north olmalıdır' });
      }
      const latSpan = Math.abs(north - south);
      const lngSpan = Math.abs(east - west);
      if (latSpan > 8 || lngSpan > 12) {
        return res.status(400).json({ success: false, message: 'Xəritə sahəsi çox böyükdür' });
      }
      n = clamp(north, -90, 90);
      s = clamp(south, -90, 90);
      e = clamp(east, -180, 180);
      w = clamp(west, -180, 180);
      hasBounds = true;
    }

    if (!hasBounds) {
      return res.status(400).json({
        success: false,
        message: 'north,south,east,west və ya lat,lng,radius_km göndərin',
      });
    }

    const params = [n, s, w, e];
    let kindSql = '';
    if (kindFilter) {
      params.push(kindFilter);
      kindSql = ` AND ip.map_profile_kind = $${params.length}`;
    }

    const userLat = parseFloatQ(req.query.user_lat);
    const userLng = parseFloatQ(req.query.user_lng);
    const sortLat = userLat != null ? userLat : lat;
    const sortLng = userLng != null ? userLng : lng;

    let distanceSql = '';
    let orderSql = 'ORDER BY u.full_name ASC';
    if (sortLat != null && sortLng != null) {
      params.push(sortLat, sortLng);
      const latP = params.length - 1;
      const lngP = params.length;
      distanceSql = `, (
        6371 * acos(
          LEAST(
            1,
            GREATEST(
              -1,
              cos(radians($${latP})) * cos(radians(ip.latitude::float8))
                * cos(radians(ip.longitude::float8) - radians($${lngP}))
                + sin(radians($${latP})) * sin(radians(ip.latitude::float8))
            )
          )
        )
      )::float8 AS distance_km`;
      orderSql = 'ORDER BY distance_km ASC NULLS LAST, u.full_name ASC';
    }

    const { rows } = await db.query(
      `SELECT
         u.id,
         u.full_name,
         COALESCE(NULLIF(TRIM(ip.subject), ''), '—') AS subject,
         ip.latitude::float8 AS latitude,
         ip.longitude::float8 AS longitude,
         ip.map_profile_kind
         ${distanceSql}
       FROM users u
       INNER JOIN instructor_profiles ip ON ip.user_id = u.id
       WHERE u.role = 'instructor'
         AND COALESCE(u.is_active, TRUE) = TRUE
         AND u.deleted_at IS NULL
         AND COALESCE(ip.map_visible, TRUE) = TRUE
         AND ip.latitude IS NOT NULL
         AND ip.longitude IS NOT NULL
         AND ip.latitude BETWEEN $2 AND $1
         AND ip.longitude BETWEEN LEAST($3::float8, $4::float8) AND GREATEST($3::float8, $4::float8)
         ${kindSql}
       ${orderSql}
       LIMIT 200`,
      params
    );

    res.set('Cache-Control', 'public, max-age=30');
    res.json({ success: true, instructors: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
};

module.exports = { getInstructorsInMapView };
