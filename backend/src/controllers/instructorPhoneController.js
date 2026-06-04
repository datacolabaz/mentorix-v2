const db = require('../utils/db');
const {
  assertInstructorPhoneAvailable,
  instructorNeedsPhoneBinding,
} = require('../utils/instructorPhone');

const bindInstructorPhone = async (req, res) => {
  try {
    if (req.user?.role !== 'instructor') {
      return res.status(403).json({ success: false, message: 'Yalnız müəllimlər üçün' });
    }
    const phoneRaw = req.body?.phone ?? req.body?.phone_number;
    const phoneCanon = await assertInstructorPhoneAvailable(db, phoneRaw, req.user.id);

    const { rows } = await db.query(
      `UPDATE users
       SET phone = $1, phone_verified = TRUE
       WHERE id = $2::uuid AND role = 'instructor'
       RETURNING id, full_name, email, role, phone, phone_verified`,
      [phoneCanon, req.user.id],
    );
    const u = rows[0];
    if (!u) {
      return res.status(404).json({ success: false, message: 'Hesab tapılmadı' });
    }

    res.json({
      success: true,
      message: 'Mobil nömrə təsdiqləndi',
      user: {
        id: u.id,
        full_name: u.full_name,
        email: u.email,
        role: u.role,
        phone: u.phone,
        phone_verified: Boolean(u.phone_verified),
      },
      needs_instructor_phone: false,
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
      code: err.code,
    });
  }
};

const instructorPhoneStatus = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, role, phone, phone_verified FROM users WHERE id = $1 LIMIT 1`,
      [req.user.id],
    );
    const u = rows[0];
    res.json({
      success: true,
      needs_instructor_phone: instructorNeedsPhoneBinding(u),
      phone: u?.phone || null,
      phone_verified: Boolean(u?.phone_verified),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  bindInstructorPhone,
  instructorPhoneStatus,
};
