const db = require('../utils/db');
const { canonicalStudentPhone } = require('../utils/studentPhone');

/**
 * GET /api/public/instructors/:id/messaging
 * Yalnız daxil olmuş tələbə — WhatsApp linki (müəllimin qeydiyyat telefonu).
 */
const getInstructorMessagingLink = async (req, res) => {
  try {
    const instructorId = String(req.params.id || '').trim();
    if (!instructorId) {
      return res.status(400).json({ success: false, message: 'Müəllim ID tələb olunur' });
    }
    if (!['student', 'parent'].includes(req.user?.role)) {
      return res.status(403).json({ success: false, message: 'Yalnız tələbələr əlaqə edə bilər' });
    }

    const { rows } = await db.query(
      `SELECT u.id, u.full_name, u.phone, ip.map_visible
       FROM users u
       INNER JOIN instructor_profiles ip ON ip.user_id = u.id
       WHERE u.id = $1::uuid
         AND u.role = 'instructor'
         AND COALESCE(u.is_active, TRUE) = TRUE
         AND u.deleted_at IS NULL
         AND COALESCE(ip.map_visible, TRUE) = TRUE
       LIMIT 1`,
      [instructorId],
    );
    const row = rows[0];
    if (!row) {
      return res.status(404).json({ success: false, message: 'Müəllim tapılmadı' });
    }

    const e164 = canonicalStudentPhone(row.phone);
    if (!e164) {
      return res.json({
        success: true,
        whatsapp_available: false,
        whatsapp_url: null,
        instructor_name: row.full_name,
      });
    }

    const digits = e164.replace(/\D/g, '');
    const studentName = req.user?.full_name || 'Tələbə';
    const text = encodeURIComponent(
      `Salam ${row.full_name}, Mentorix xəritəsindən yazıram. Dərs barədə məlumat almaq istəyirəm. (${studentName})`,
    );

    res.json({
      success: true,
      whatsapp_available: true,
      whatsapp_url: `https://wa.me/${digits}?text=${text}`,
      instructor_name: row.full_name,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
};

module.exports = { getInstructorMessagingLink };
