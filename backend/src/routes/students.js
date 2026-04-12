const router = require('express').Router();
const { listStudents, getStudent, deleteStudent } = require('../controllers/studentController');
const { authenticate, authorize } = require('../middleware/auth');
const db = require('../utils/db');

function sameUuid(a, b) {
  if (a == null || b == null) return false;
  return String(a).replace(/-/g, '').toLowerCase() === String(b).replace(/-/g, '').toLowerCase();
}

function normUuid(id) {
  return String(id).trim().toLowerCase().replace(/-/g, '');
}

function parseMonthlyFee(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function parsePaymentStartDate(v) {
  if (v === undefined || v === null || v === '') return null;
  const s = String(v).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, mo, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return s;
}

/** 1–7 unikal, sıralı (B.e. … Bazar) */
function parseLessonWeekdays(raw) {
  if (raw == null) return [];
  let arr = raw;
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  const set = new Set();
  for (const x of arr) {
    const d = parseInt(String(x), 10);
    if (Number.isFinite(d) && d >= 1 && d <= 7) set.add(d);
  }
  return [...set].sort((a, b) => a - b);
}

router.get('/', authenticate, authorize('admin', 'instructor'), listStudents);

router.delete('/enrollment/:enrollmentId', authenticate, authorize('admin', 'instructor'), deleteStudent);

router.post('/enroll', authenticate, authorize('instructor', 'admin'), async (req, res) => {
  try {
    const {
      student_id,
      billing_type,
      referral_notes,
      referral_source_id,
      parent_name,
      parent_phone,
      monthly_fee,
      payment_start_date,
      teacher_schedule_id,
      lesson_weekdays,
    } = req.body;
    const instructor_id = req.user.role === 'admin' ? req.body.instructor_id : req.user.id;
    const ni = normUuid(instructor_id);

    const lwd = parseLessonWeekdays(lesson_weekdays);
    if (lwd.length === 0) {
      return res.status(400).json({ success: false, message: 'Ən azı bir dərs günü seçin' });
    }

    const { rows: cnt } = await db.query(
      `SELECT COUNT(*)::int AS n FROM teacher_schedules
       WHERE REPLACE(LOWER(TRIM(instructor_id::text)), '-', '') = $1`,
      [ni]
    );
    if ((cnt[0]?.n || 0) > 0 && !teacher_schedule_id) {
      return res.status(400).json({ success: false, message: 'Dərs vaxtı (boş slot) seçin' });
    }

    const mf = parseMonthlyFee(monthly_fee);
    const psd = parsePaymentStartDate(payment_start_date);

    const enrollment = await db.transaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO enrollments (instructor_id, student_id, billing_type, referral_notes, referral_source_id, lesson_weekdays)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb) RETURNING *`,
        [
          instructor_id,
          student_id,
          billing_type || '8_lessons',
          referral_notes,
          referral_source_id || null,
          JSON.stringify(lwd),
        ]
      );
      const enr = rows[0];

      if (teacher_schedule_id) {
        const up = await client.query(
          `UPDATE teacher_schedules
           SET is_occupied = TRUE, enrollment_id = $1, student_id = $2
           WHERE id = $3
             AND REPLACE(LOWER(TRIM(instructor_id::text)), '-', '') = $4
             AND is_occupied = FALSE
           RETURNING id`,
          [enr.id, student_id, teacher_schedule_id, ni]
        );
        if (up.rowCount === 0) {
          throw Object.assign(new Error('SLOT_UNAVAILABLE'), { code: 'SLOT' });
        }
      }

      const pn = parent_name != null ? String(parent_name).trim() : '';
      const pp = parent_phone != null ? String(parent_phone).trim() : '';
      const pr = await client.query(
        `UPDATE student_profiles SET
          parent_name = COALESCE(NULLIF($1, ''), parent_name),
          parent_phone = COALESCE(NULLIF($2, ''), parent_phone),
          monthly_fee = $3,
          payment_start_date = $4
         WHERE user_id = $5`,
        [pn, pp, mf, psd, student_id]
      );
      if (pr.rowCount === 0) {
        await client.query(
          `INSERT INTO student_profiles (user_id, parent_name, parent_phone, monthly_fee, payment_start_date)
           VALUES ($1, NULLIF($2, ''), NULLIF($3, ''), $4, $5)`,
          [student_id, pn, pp, mf, psd]
        );
      }
      return enr;
    });

    res.json({ success: true, enrollment });
  } catch (err) {
    if (err.code === 'SLOT') {
      return res.status(409).json({
        success: false,
        message: 'Seçilmiş slot artıq mövcud deyil və ya məşğuldur',
      });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// Telebe ve enrollment redakte et
router.patch('/enrollment/:enrollmentId', authenticate, authorize('admin', 'instructor'), async (req, res) => {
  try {
    const {
      full_name,
      email,
      phone,
      billing_type,
      referral_notes,
      parent_name,
      parent_phone,
      monthly_fee,
      payment_start_date,
      lesson_weekdays,
    } = req.body;
    const { enrollmentId } = req.params;

    const { rows: enrRows } = await db.query(
      'SELECT student_id, instructor_id FROM enrollments WHERE id = $1',
      [enrollmentId]
    );
    if (!enrRows[0]) return res.status(404).json({ success: false, message: 'Enrollment tapilmadi' });
    const { student_id: studentId, instructor_id: enrollmentInstructorId } = enrRows[0];

    if (req.user.role === 'instructor' && !sameUuid(enrollmentInstructorId, req.user.id)) {
      return res.status(403).json({ success: false, message: 'Bu qeydiyyata icazəniz yoxdur' });
    }

    await db.query(
      'UPDATE users SET full_name = $1, email = $2, phone = $3 WHERE id = $4',
      [full_name, email || null, phone, studentId]
    );

    const hasLwd = Object.prototype.hasOwnProperty.call(req.body, 'lesson_weekdays');
    if (hasLwd) {
      const lwd = parseLessonWeekdays(lesson_weekdays);
      if (lwd.length === 0) {
        return res.status(400).json({ success: false, message: 'Ən azı bir dərs günü seçin' });
      }
      await db.query(
        'UPDATE enrollments SET billing_type = $1, referral_notes = $2, lesson_weekdays = $3::jsonb WHERE id = $4',
        [billing_type, referral_notes || null, JSON.stringify(lwd), enrollmentId]
      );
    } else {
      await db.query(
        'UPDATE enrollments SET billing_type = $1, referral_notes = $2 WHERE id = $3',
        [billing_type, referral_notes || null, enrollmentId]
      );
    }

    const pName = parent_name != null ? String(parent_name).trim() : '';
    const pPhone = parent_phone != null ? String(parent_phone).trim() : '';
    const hasMf = Object.prototype.hasOwnProperty.call(req.body, 'monthly_fee');
    const hasPsd = Object.prototype.hasOwnProperty.call(req.body, 'payment_start_date');
    const mf = hasMf ? parseMonthlyFee(monthly_fee) : null;
    const psd = hasPsd ? parsePaymentStartDate(payment_start_date) : null;
    const profUp = await db.query(
      `UPDATE student_profiles SET
        parent_name = NULLIF($1, ''),
        parent_phone = NULLIF($2, ''),
        monthly_fee = CASE WHEN $6 THEN $3::numeric ELSE monthly_fee END,
        payment_start_date = CASE WHEN $7 THEN $4::date ELSE payment_start_date END
       WHERE user_id = $5`,
      [pName, pPhone, mf, psd, studentId, hasMf, hasPsd]
    );
    if (profUp.rowCount === 0) {
      await db.query(
        `INSERT INTO student_profiles (user_id, parent_name, parent_phone, monthly_fee, payment_start_date)
         VALUES ($1, NULLIF($2, ''), NULLIF($3, ''), $4, $5)`,
        [studentId, pName, pPhone, hasMf ? mf : null, hasPsd ? psd : null]
      );
    }

    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.patch('/:id/phone', authenticate, authorize('admin', 'instructor'), async (req, res) => {
  try {
    const { phone } = req.body;
    await db.query('UPDATE users SET phone = $1 WHERE id = $2', [phone, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/:id', authenticate, getStudent);

module.exports = router;
