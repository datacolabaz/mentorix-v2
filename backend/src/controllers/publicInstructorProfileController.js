const db = require('../utils/db');
const { enrichInstructorListingRow } = require('../services/mapListingPlanService');

/**
 * GET /api/public/instructors/:id
 * İctimai müəllim bio səhifəsi (yalnız map_visible müəllimlər).
 */
const getPublicInstructorProfile = async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) {
      return res.status(400).json({ success: false, message: 'Müəllim ID tələb olunur' });
    }

    const { rows } = await db.query(
      `SELECT
         u.id,
         u.full_name,
         COALESCE(NULLIF(TRIM(ip.subject), ''), '—') AS subject,
         ip.latitude::float8 AS latitude,
         ip.longitude::float8 AS longitude,
         ip.map_profile_kind,
         ip.avatar_url,
         ip.discover_hourly_rate,
         ip.discover_bio,
         ip.discover_verified,
         ip.teacher_place_address,
         COALESCE(s.plan, 'basic') AS plan,
         (
           SELECT COALESCE(json_agg(json_build_object('format', df.format, 'travel_radius_km', df.travel_radius_km) ORDER BY df.format), '[]'::json)
           FROM instructor_delivery_formats df WHERE df.user_id = u.id
         ) AS delivery_formats,
         (
           SELECT COALESCE(json_agg(c.name_az ORDER BY c.name_az), '[]'::json)
           FROM instructor_categories ic
           INNER JOIN categories c ON c.id = ic.category_id
           WHERE ic.user_id = u.id
           LIMIT 12
         ) AS category_names
       FROM users u
       INNER JOIN instructor_profiles ip ON ip.user_id = u.id
       LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
       WHERE u.id = $1
         AND u.role = 'instructor'
         AND COALESCE(u.is_active, TRUE) = TRUE
         AND u.deleted_at IS NULL
         AND COALESCE(ip.map_visible, TRUE) = TRUE
       LIMIT 1`,
      [id],
    );

    const row = rows[0];
    if (!row) {
      return res.status(404).json({ success: false, message: 'Müəllim tapılmadı və ya profil gizlidir' });
    }

    res.set('Cache-Control', 'public, max-age=60');
    res.json({
      success: true,
      instructor: enrichInstructorListingRow({
        ...row,
        delivery_formats: Array.isArray(row.delivery_formats) ? row.delivery_formats : [],
        category_names: Array.isArray(row.category_names) ? row.category_names : [],
      }),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
};

module.exports = { getPublicInstructorProfile };
