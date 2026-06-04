const db = require('../utils/db');
const { upsertStudentContactPhone } = require('../utils/studentPhone');

/**
 * PATCH /api/auth/profile — öz adını yeniləmək (müəllim / kurs / tələbə).
 * Tələbə: phone_number (əlaqə nömrəsi, SMS üçün istəyə bağlı).
 */
const patchMyProfile = async (req, res) => {
  try {
    const hasName = req.body?.full_name != null;
    const hasPhone = req.body?.phone_number != null;
    if (!hasName && !hasPhone) {
      return res.status(400).json({ success: false, message: 'Yenilənəcək məlumat göndərin' });
    }

    let fullName = null;
    if (hasName) {
      fullName = String(req.body.full_name).trim();
      if (!fullName || fullName.length < 2) {
        return res.status(400).json({ success: false, message: 'Ad və soyad ən azı 2 simvol olmalıdır' });
      }
      if (fullName.length > 120) {
        return res.status(400).json({ success: false, message: 'Ad çox uzundur (max 120)' });
      }
    }

    if (hasPhone && req.user.role !== 'student') {
      return res.status(403).json({ success: false, message: 'Telefon yalnız tələbə hesabında yenilənir' });
    }

    const user = await db.transaction(async (client) => {
      if (hasPhone) {
        await upsertStudentContactPhone(client, req.user.id, req.body.phone_number);
      }
      if (hasName) {
        await client.query(
          `UPDATE users SET full_name = $1 WHERE id = $2 AND deleted_at IS NULL`,
          [fullName, req.user.id],
        );
      }
      const { rows } = await client.query(
        `SELECT u.id, u.full_name, u.email, u.phone, u.role, u.phone_verified, u.is_active, u.is_verified, u.role_selected,
                sp.phone_number
         FROM users u
         LEFT JOIN student_profiles sp ON sp.user_id = u.id
         WHERE u.id = $1 AND u.deleted_at IS NULL`,
        [req.user.id],
      );
      return rows[0];
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'İstifadəçi tapılmadı' });
    }
    res.json({ success: true, user });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message || 'Xəta' });
  }
};

module.exports = { patchMyProfile };
