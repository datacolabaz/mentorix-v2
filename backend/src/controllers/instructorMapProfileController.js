const db = require('../utils/db');
const {
  isBakuRegion,
  isValidRegion,
  isValidBakuDistrict,
  normalizeRegionName,
} = require('../lib/azerbaijanRegions');

function parseCoord(v) {
  if (v === null || v === '') return null;
  const n = Number.parseFloat(String(v).replace(',', '.'));
  if (!Number.isFinite(n)) return undefined;
  return n;
}

/** PATCH /api/instructor/map-profile — yalnız öz profili */
const patchInstructorMapProfile = async (req, res) => {
  try {
    const uid = req.user.id;
    const latRaw = req.body?.latitude;
    const lngRaw = req.body?.longitude;
    const lat = latRaw === undefined ? undefined : parseCoord(latRaw);
    const lng = lngRaw === undefined ? undefined : parseCoord(lngRaw);

    if (lat !== undefined && lat !== null && (lat < -90 || lat > 90)) {
      return res.status(400).json({ success: false, message: 'latitude -90…90 aralığında olmalıdır' });
    }
    if (lng !== undefined && lng !== null && (lng < -180 || lng > 180)) {
      return res.status(400).json({ success: false, message: 'longitude -180…180 aralığında olmalıdır' });
    }

    let kind = req.body?.map_profile_kind;
    if (kind != null) {
      kind = String(kind).toLowerCase().trim();
      if (kind !== 'teacher' && kind !== 'trainer') {
        return res.status(400).json({ success: false, message: 'map_profile_kind: teacher və ya trainer' });
      }
    }

    let mapSearchRadius = req.body?.map_search_radius_km;
    if (mapSearchRadius !== undefined && mapSearchRadius !== null) {
      mapSearchRadius = Number.parseInt(mapSearchRadius, 10);
      if (!Number.isFinite(mapSearchRadius) || mapSearchRadius < 1 || mapSearchRadius > 200) {
        return res.status(400).json({ success: false, message: 'map_search_radius_km 1…200 olmalıdır' });
      }
    } else {
      mapSearchRadius = undefined;
    }

    let mapVisible = req.body?.map_visible;
    if (mapVisible !== undefined && mapVisible !== null) {
      mapVisible =
        mapVisible === true ||
        mapVisible === 1 ||
        mapVisible === '1' ||
        mapVisible === 'true' ||
        mapVisible === 'TRUE';
    } else {
      mapVisible = undefined;
    }

    const sets = [];
    const vals = [];
    let i = 1;

    if (lat !== undefined) {
      sets.push(`latitude = $${i++}`);
      vals.push(lat);
    }
    if (lng !== undefined) {
      sets.push(`longitude = $${i++}`);
      vals.push(lng);
    }
    if (kind != null) {
      sets.push(`map_profile_kind = $${i++}`);
      vals.push(kind);
    }
    if (mapVisible !== undefined) {
      sets.push(`map_visible = $${i++}`);
      vals.push(mapVisible);
    }
    if (mapSearchRadius !== undefined) {
      sets.push(`map_search_radius_km = $${i++}`);
      vals.push(mapSearchRadius);
    }

    if (req.body?.region !== undefined) {
      const region = req.body.region == null ? null : normalizeRegionName(req.body.region);
      if (region && !isValidRegion(region)) {
        return res.status(400).json({ success: false, message: 'Düzgün olmayan region' });
      }
      sets.push(`region = $${i++}`);
      vals.push(region);
      if (!isBakuRegion(region)) {
        sets.push(`baku_district = $${i++}`);
        vals.push(null);
      }
    }
    if (req.body?.baku_district !== undefined) {
      const district =
        req.body.baku_district == null ? null : normalizeRegionName(req.body.baku_district);
      if (district && !isValidBakuDistrict(district)) {
        return res.status(400).json({ success: false, message: 'Düzgün olmayan Bakı rayonu' });
      }
      sets.push(`baku_district = $${i++}`);
      vals.push(district);
    }

    if (!sets.length) {
      return res.status(400).json({ success: false, message: 'Yenilənən sahə yoxdur' });
    }

    vals.push(uid);
    const { rows } = await db.query(
      `UPDATE instructor_profiles SET ${sets.join(', ')} WHERE user_id = $${i}
       RETURNING latitude, longitude, map_profile_kind, map_visible, map_search_radius_km, region, baku_district`,
      vals
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Müəllim profili tapılmadı' });
    }

    res.json({ success: true, map: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
};

module.exports = { patchInstructorMapProfile };
