const db = require('../utils/db');
const { sendSms } = require('../services/smsService');

const markAttendance = async (req, res) => {
  try {
    const { enrollment_id, date, attended, session_score, notes } = req.body;

    if (enrollment_id === '' || enrollment_id == null) {
      return res.status(400).json({ success: false, message: 'Tələbə (qeydiyyat) seçilməlidir' });
    }

    let sessionScoreSql = null;
    if (session_score !== '' && session_score !== undefined && session_score !== null) {
      const n = Number(session_score);
      if (Number.isNaN(n) || n < 0 || n > 100) {
        return res.status(400).json({ success: false, message: 'Bal 0–100 arası olmalıdır' });
      }
      sessionScoreSql = Math.round(n);
    }

    const { rows: [enrollment] } = await db.query(
      `SELECT e.*, ip.alert_lessons_before, ip.billing_type AS instr_billing,
              u.full_name AS student_name, u.phone AS student_phone,
              sp.parent_id,
              COALESCE(NULLIF(TRIM(sp.parent_phone), ''), pu.phone) AS parent_phone
       FROM enrollments e
       JOIN instructor_profiles ip ON ip.user_id = e.instructor_id
       JOIN users u ON u.id = e.student_id
       LEFT JOIN student_profiles sp ON sp.user_id = e.student_id
       LEFT JOIN users pu ON pu.id = sp.parent_id
       WHERE e.id = $1`,
      [enrollment_id]
    );

    if (!enrollment)
      return res.status(404).json({ success: false, message: 'Qeydiyyat tapılmadı' });

    const lessonNum = enrollment.lesson_count + 1;

    await db.query(
      `INSERT INTO attendance (enrollment_id, lesson_number, date, attended, session_score, notes)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [enrollment_id, lessonNum, date, Boolean(attended), sessionScoreSql, notes || null]
    );

    if (attended) {
      await db.query(
        'UPDATE enrollments SET lesson_count = lesson_count + 1 WHERE id = $1',
        [enrollment_id]
      );
    }

    const billingLimit = enrollment.billing_type === '8_lessons' ? 8
      : enrollment.billing_type === '12_lessons' ? 12 : null;

    const alertAt = billingLimit
      ? billingLimit - enrollment.alert_lessons_before
      : null;

    if (attended && alertAt && lessonNum === alertAt) {
      const targetPhone = enrollment.parent_phone || enrollment.student_phone;
      const remaining = billingLimit - lessonNum;

      await sendSms({
        instructorId: enrollment.instructor_id,
        phone: targetPhone,
        message: `Mentorix: ${enrollment.student_name} ucun ${remaining} ders qalir. Odenis etmeyi unutmayin!`,
      });
    }

    res.json({ success: true, lesson_number: lessonNum });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getAttendance = async (req, res) => {
  try {
    const { enrollment_id } = req.params;
    const { rows: enRows } = await db.query(
      'SELECT student_id, instructor_id FROM enrollments WHERE id = $1',
      [enrollment_id]
    );
    if (!enRows[0]) return res.status(404).json({ success: false, message: 'Tapılmadı' });
    const { student_id: enStudent, instructor_id: enInstr } = enRows[0];
    if (req.user.role === 'student' && String(enStudent) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
    }
    if (
      req.user.role === 'instructor' &&
      String(enInstr).replace(/-/g, '').toLowerCase() !== String(req.user.id).replace(/-/g, '').toLowerCase()
    ) {
      return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
    }

    const { rows } = await db.query(
      'SELECT * FROM attendance WHERE enrollment_id=$1 ORDER BY lesson_number',
      [enrollment_id]
    );
    res.json({ success: true, attendance: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { markAttendance, getAttendance };
