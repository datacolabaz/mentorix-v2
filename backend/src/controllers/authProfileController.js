const db = require('../utils/db');

/**
 * PATCH /api/auth/profile — öz adını yeniləmək (müəllim / kurs / tələbə).
 */
const patchMyProfile = async (req, res) => {
  try {
    const fullName = req.body?.full_name != null ? String(req.body.full_name).trim() : null;
    if (!fullName || fullName.length < 2) {
      return res.status(400).json({ success: false, message: 'Ad və soyad ən azı 2 simvol olmalıdır' });
    }
    if (fullName.length > 120) {
      return res.status(400).json({ success: false, message: 'Ad çox uzundur (max 120)' });
    }

    const { rows } = await db.query(
      `UPDATE users SET full_name = $1 WHERE id = $2 AND deleted_at IS NULL
       RETURNING id, full_name, email, phone, role, phone_verified, is_active, is_verified, role_selected`,
      [fullName, req.user.id],
    );
    if (!rows[0]) {
      return res.status(404).json({ success: false, message: 'İstifadəçi tapılmadı' });
    }
    res.json({ success: true, user: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
};

module.exports = { patchMyProfile };
