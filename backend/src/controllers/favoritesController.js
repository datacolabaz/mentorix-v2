const db = require('../utils/db');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validUuid(value) {
  return UUID_RE.test(String(value || '').trim());
}

async function listFavorites(req, res) {
  const { rows } = await db.query(
    `SELECT u.id, u.full_name, u.email, ip.subject, ip.map_profile_kind,
            ip.latitude, ip.longitude, ip.nearest_metro, uf.created_at AS favorited_at
       FROM user_favorites uf
       INNER JOIN users u ON u.id = uf.instructor_id AND u.is_active = TRUE
       LEFT JOIN instructor_profiles ip ON ip.user_id = u.id
      WHERE uf.user_id = $1
      ORDER BY uf.created_at DESC`,
    [req.user.id],
  );
  return res.json({ success: true, favorites: rows });
}

async function addFavorite(req, res) {
  const instructorId = String(req.params.instructorId || '').trim();
  if (!validUuid(instructorId)) return res.status(400).json({ success: false, message: 'Mentor ID etibarsızdır' });
  if (instructorId === String(req.user.id)) {
    return res.status(400).json({ success: false, message: 'Öz profilinizi favoritə əlavə edə bilməzsiniz' });
  }
  const { rowCount } = await db.query(
    `INSERT INTO user_favorites (user_id, instructor_id)
     SELECT $1, u.id FROM users u
      WHERE u.id = $2 AND u.is_active = TRUE AND u.role = 'instructor'
     ON CONFLICT (user_id, instructor_id) DO UPDATE SET created_at = user_favorites.created_at`,
    [req.user.id, instructorId],
  );
  if (!rowCount) return res.status(404).json({ success: false, message: 'Mentor tapılmadı' });
  return res.status(201).json({ success: true, instructor_id: instructorId, favorited: true });
}

async function removeFavorite(req, res) {
  const instructorId = String(req.params.instructorId || '').trim();
  if (!validUuid(instructorId)) return res.status(400).json({ success: false, message: 'Mentor ID etibarsızdır' });
  await db.query('DELETE FROM user_favorites WHERE user_id = $1 AND instructor_id = $2', [req.user.id, instructorId]);
  return res.json({ success: true, instructor_id: instructorId, favorited: false });
}

module.exports = { listFavorites, addFavorite, removeFavorite };
