const db = require('../utils/db');
const { sendSms } = require('../services/smsService');

const markAttendance = async (req, res) => {
  try {
    const { enrollment_id, date, attended, session_score, notes } = req.body;

    const { rows: [enrollment] } = await db.query(
      `SELECT e.*, ip.alert_lessons_before, ip.billing_type AS instr_billing,
              u.full_name AS student_name, u.phone AS student_phone,
              sp.parent_id, pu.phone AS parent_phone
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
      [enrollment_id, lessonNum, date, attended, session_score, notes]
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
