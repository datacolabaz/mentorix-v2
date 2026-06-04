const db = require('../utils/db');
const { instructorNeedsPhoneBinding } = require('../utils/instructorPhone');

/** @deprecated OTP axını: POST /auth/phone/send-otp */
const bindInstructorPhone = async (req, res) => {
  try {
    if (req.user?.role !== 'instructor') {
      return res.status(403).json({ success: false, message: 'Yalnız müəllimlər üçün' });
    }
    const { rows: meRows } = await db.query(
      `SELECT phone_verified FROM users WHERE id = $1::uuid AND role = 'instructor' LIMIT 1`,
      [req.user.id],
    );
    if (meRows[0]?.phone_verified) {
      return res.status(403).json({
        success: false,
        message: 'Mobil nömrə artıq təsdiqlənib.',
        code: 'PHONE_ALREADY_VERIFIED',
      });
    }
    return res.status(400).json({
      success: false,
      message: 'SMS OTP ilə təsdiq edin (paneldə SMS göndərəndə açılan pəncərə və ya /auth/phone/send-otp).',
      code: 'USE_PHONE_OTP',
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
