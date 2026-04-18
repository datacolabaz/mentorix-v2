const router = require('express').Router();
const {
  listStudents,
  getStudent,
  deleteStudent,
  getMySchedule,
  getInstructorMyLessonsCalendar,
  addMyPrepSlots,
  deleteMyPrepSlot,
} = require('../controllers/studentController');
const { authenticate, authorize } = require('../middleware/auth');
const db = require('../utils/db');
const { deliverPermanentPinSms } = require('../controllers/authController');

function normalizePhoneDigits(phone) {
  return String(phone || '').replace(/\D/g, '');
}

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

/** Aylıq: postpaid (aylıq dövr borcu) / prepaid (dərs balansı) */
function parseBillingTiming(v) {
  if (String(v || '').trim().toLowerCase() === 'prepaid') return 'prepaid';
  return 'postpaid';
}

function parsePaymentPlan(v) {
  return String(v || '').trim().toLowerCase() === 'partial' ? 'partial' : 'full';
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

function parseLessonTimes(raw, lessonWeekdays) {
  if (raw == null) return {};
  let obj = raw;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      obj = {};
    }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
  const out = {};
  const days = Array.isArray(lessonWeekdays) ? lessonWeekdays : [];
  for (const d of days) {
    const v = obj[d] ?? obj[String(d)];
    if (v == null || v === '') continue;
    const s = String(v).trim();
    if (!/^\d{1,2}:\d{2}$/.test(s)) continue;
    const [h, m] = s.split(':').map(Number);
    if (h < 0 || h > 23 || m < 0 || m > 59) continue;
    out[String(d)] = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  return out;
}

function billingLimit(type) {
  if (type === '8_lessons') return 8;
  if (type === '12_lessons') return 12;
  return null;
}

function weekdayFromYmd(ymd) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(String(ymd))) return null;
  const [y, mo, d] = String(ymd).split('-').map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return ((dt.getUTCDay() + 6) % 7) + 1; // Mon=1..Sun=7
}

function nextDateForWeekday(afterYmd, weekday /*1-7*/, ymdInclusive) {
  // use UTC dates to avoid TZ drift; store as YYYY-MM-DD
  const [y, mo, d] = afterYmd.split('-').map(Number);
  const base = new Date(Date.UTC(y, mo - 1, d));
  const baseDow = ((base.getUTCDay() + 6) % 7) + 1; // Mon=1..Sun=7
  let delta = (weekday - baseDow + 7) % 7;
  if (delta === 0 && !ymdInclusive) delta = 7;
  const dt = new Date(base.getTime() + delta * 86400000);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function generateLessonStarts({ startYmd, lessonWeekdays, lessonTimes, count }) {
  // include startYmd: the first lesson can be on this exact date
  let cursor = startYmd;
  const out = [];
  for (let i = 0; i < count; i++) {
    let best = null;
    for (const wd of lessonWeekdays) {
      const t = lessonTimes[String(wd)];
      if (!t) continue;
      const nextYmd = nextDateForWeekday(cursor, wd, true);
      const ts = `${nextYmd} ${t}:00`;
      if (!best || ts < best) best = ts;
    }
    if (!best) break;
    out.push(best);
    // next search strictly after this lesson date
    cursor = best.slice(0, 10);
    // move cursor forward one day to avoid repeating same day when multiple weekdays include it
    const [yy, mm, dd] = cursor.split('-').map(Number);
    const dt = new Date(Date.UTC(yy, mm - 1, dd));
    const next = new Date(dt.getTime() + 86400000);
    cursor = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(
      next.getUTCDate()
    ).padStart(2, '0')}`;
  }
  return out;
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
      enrollment_date,
      billing_timing,
      payment_plan,
      first_lesson_date,
      teacher_schedule_id,
      lesson_weekdays,
      lesson_times,
    } = req.body;
    const instructor_id = req.user.role === 'admin' ? req.body.instructor_id : req.user.id;
    const ni = normUuid(instructor_id);

    const lwd = parseLessonWeekdays(lesson_weekdays);
    if (lwd.length === 0) {
      return res.status(400).json({ success: false, message: 'Ən azı bir dərs günü seçin' });
    }
    const lt = parseLessonTimes(lesson_times, lwd);
    if (Object.keys(lt).length === 0) {
      return res.status(400).json({ success: false, message: 'Dərs günlərinə uyğun saatları qeyd edin' });
    }

    const limitForValidation = billingLimit(billing_type || '8_lessons');
    const firstYmd = parsePaymentStartDate(first_lesson_date);
    if (limitForValidation && !firstYmd) {
      return res.status(400).json({ success: false, message: 'İlk dərs tarixi seçilməlidir' });
    }
    if (limitForValidation && firstYmd && firstYmd < enrollmentYmd) {
      return res.status(400).json({
        success: false,
        message: 'İlk dərs tarixi, dərslərə başlama tarixindən əvvəl ola bilməz',
      });
    }
    if (limitForValidation && firstYmd) {
      const wd = weekdayFromYmd(firstYmd);
      if (!wd || !lwd.includes(wd) || !lt[String(wd)]) {
        return res.status(400).json({
          success: false,
          message: 'İlk dərs tarixi seçdiyiniz dərs günləri/saatları ilə uyğun deyil',
        });
      }
    }

    const { rows: cnt } = await db.query(
      `SELECT COUNT(*)::int AS n FROM teacher_schedules
       WHERE REPLACE(LOWER(TRIM(instructor_id::text)), '-', '') = $1`,
      [ni]
    );
    // artıq tələb olunmur: dərs vaxtı həftəlik gün/saat + ilk dərs tarixi ilə generasiya olunur

    const mf = parseMonthlyFee(monthly_fee);
    const enrollmentYmd = parsePaymentStartDate(enrollment_date);
    if (!enrollmentYmd) {
      return res.status(400).json({ success: false, message: 'Dərslərə başlama tarixi seçilməlidir' });
    }
    const bt = (billing_type || '8_lessons') === 'monthly' ? parseBillingTiming(billing_timing) : 'postpaid';
    const payPlan = (billing_type || '8_lessons') === 'monthly' ? parsePaymentPlan(payment_plan) : 'full';

    const enrollment = await db.transaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO enrollments (instructor_id, student_id, billing_type, referral_notes, referral_source_id, lesson_weekdays, lesson_times, enrollment_start_date, billing_timing, payment_plan)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::date,$9,$10) RETURNING *`,
        [
          instructor_id,
          student_id,
          billing_type || '8_lessons',
          referral_notes,
          referral_source_id || null,
          JSON.stringify(lwd),
          JSON.stringify(lt),
          enrollmentYmd,
          bt,
          payPlan,
        ]
      );
      const enr = rows[0];

      // teacher_schedules ilə bağlama artıq istifadə olunmur (dərslər dated lessons kimi saxlanır)

      const pn = parent_name != null ? String(parent_name).trim() : '';
      const pp = parent_phone != null ? String(parent_phone).trim() : '';
      const pr = await client.query(
        `UPDATE student_profiles SET
          parent_name = COALESCE(NULLIF($1, ''), parent_name),
          parent_phone = COALESCE(NULLIF($2, ''), parent_phone),
          monthly_fee = $3
         WHERE user_id = $4`,
        [pn, pp, mf, student_id]
      );
      if (pr.rowCount === 0) {
        await client.query(
          `INSERT INTO student_profiles (user_id, parent_name, parent_phone, monthly_fee)
           VALUES ($1, NULLIF($2, ''), NULLIF($3, ''), $4)`,
          [student_id, pn, pp, mf]
        );
      }

      // generate enrollment_lessons for first billing cycle (8/12). Monthly: skip for now.
      const limit = billingLimit(enr.billing_type);
      const startYmd = firstYmd || enrollmentYmd;
      if (limit) {
        const starts = generateLessonStarts({
          startYmd,
          lessonWeekdays: lwd,
          lessonTimes: lt,
          count: limit,
        });

        // conflict check: existing lessons for instructor + occupied weekly slots
        for (let i = 0; i < starts.length; i++) {
          const ymd = starts[i].slice(0, 10);
          const time = starts[i].slice(11, 16);
          const w = weekdayFromYmd(ymd);
          const occupied = await client.query(
            `SELECT id FROM teacher_schedules
             WHERE REPLACE(LOWER(TRIM(instructor_id::text)), '-', '') = $1
               AND is_occupied = TRUE
               AND day_of_week = $2
               AND start_time = $3::time
             LIMIT 1`,
            [ni, w, time]
          );
          if (occupied.rowCount > 0) {
            throw Object.assign(new Error('LESSON_CONFLICT'), {
              code: 'LESSON_CONFLICT',
              at: `${ymd} ${time}`,
            });
          }

          const exists = await client.query(
            `SELECT id FROM lessons
             WHERE instructor_id = $1
               AND student_id <> $3
               AND lesson_date = ($2::timestamp AT TIME ZONE 'Asia/Baku')
             LIMIT 1`,
            [instructor_id, starts[i], student_id]
          );
          if (exists.rowCount > 0) {
            throw Object.assign(new Error('LESSON_CONFLICT'), {
              code: 'LESSON_CONFLICT',
              at: `${ymd} ${time}`,
            });
          }
        }

        for (let i = 0; i < starts.length; i++) {
          await client.query(
            `INSERT INTO enrollment_lessons (enrollment_id, billing_cycle, lesson_number, starts_at)
             VALUES ($1, 1, $2, $3::timestamp)
             ON CONFLICT (enrollment_id, billing_cycle, lesson_number) DO NOTHING`,
            [enr.id, i + 1, starts[i]]
          );
          await client.query(
            `INSERT INTO lessons (enrollment_id, student_id, instructor_id, lesson_date, status, lesson_number, billing_cycle)
             VALUES ($1,$2,$3,($4::timestamp AT TIME ZONE 'Asia/Baku'),'pending',$5,1)
             ON CONFLICT (enrollment_id, billing_cycle, lesson_number) DO NOTHING`,
            [enr.id, student_id, instructor_id, starts[i], i + 1]
          );
        }
      }
      return enr;
    });

    let pin_sms = { attempted: false, sent: false, skipped: false, message: '' };
    try {
      const { rows: urows } = await db.query(
        `SELECT id, role, phone, pin_hash
         FROM users
         WHERE id = $1 AND is_active = TRUE`,
        [student_id]
      );
      const u = urows[0];
      if (u && u.role === 'student') {
        const clean = normalizePhoneDigits(u.phone);
        pin_sms.attempted = true;
        if (!clean) {
          pin_sms.skipped = true;
          pin_sms.message = 'Telefon yoxdur — PIN SMS göndərilmədi.';
        } else {
          const r = await deliverPermanentPinSms(u, clean, { force: false });
          if (r.alreadyHadPin) {
            pin_sms.skipped = true;
            pin_sms.message = 'PIN artıq mövcuddur — əlavə SMS göndərilmədi.';
          } else if (r.pinSmsSent) {
            pin_sms.sent = true;
            pin_sms.message = 'Tələbənin nömrəsinə daimi 6 rəqəmli PIN SMS göndərildi.';
          }
        }
      }
    } catch (e) {
      pin_sms.attempted = true;
      pin_sms.sent = false;
      pin_sms.skipped = false;
      pin_sms.message = e?.body?.message || e?.message || 'PIN SMS göndərilə bilmədi';
      pin_sms.error = true;
    }

    res.json({ success: true, enrollment, pin_sms });
  } catch (err) {
    if (err.code === 'LESSON_CONFLICT') {
      return res.status(409).json({
        success: false,
        message: `Dərs cədvəlində uyğun olmayan vaxt var: ${err.at || ''}`.trim(),
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
      phone,
      billing_type,
      referral_notes,
      parent_name,
      parent_phone,
      monthly_fee,
      enrollment_date,
      billing_timing,
      payment_plan,
      lesson_weekdays,
      lesson_times,
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

    await db.query('UPDATE users SET full_name = $1, phone = $2 WHERE id = $3', [full_name, phone, studentId]);

    const hasLwd = Object.prototype.hasOwnProperty.call(req.body, 'lesson_weekdays');
    const hasLt = Object.prototype.hasOwnProperty.call(req.body, 'lesson_times');
    const { rows: curEnrRows } = await db.query(
      'SELECT lesson_weekdays, lesson_times FROM enrollments WHERE id = $1',
      [enrollmentId]
    );
    const curEnr = curEnrRows[0] || {};

    const lwd = hasLwd ? parseLessonWeekdays(lesson_weekdays) : parseLessonWeekdays(curEnr.lesson_weekdays);
    if ((hasLwd || hasLt) && lwd.length === 0) {
      return res.status(400).json({ success: false, message: 'Ən azı bir dərs günü seçin' });
    }
    const lt = hasLt
      ? parseLessonTimes(lesson_times, lwd)
      : parseLessonTimes(curEnr.lesson_times, lwd);
    if ((hasLwd || hasLt) && lwd.length > 0 && Object.keys(lt).length === 0) {
      return res.status(400).json({ success: false, message: 'Dərs günlərinə uyğun saatları qeyd edin' });
    }

    if (hasLwd || hasLt) {
      await db.query(
        `UPDATE enrollments
         SET billing_type = $1,
             referral_notes = $2,
             lesson_weekdays = $3::jsonb,
             lesson_times = $4::jsonb
         WHERE id = $5`,
        [billing_type, referral_notes || null, JSON.stringify(lwd), JSON.stringify(lt), enrollmentId]
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
    const hasEnr = Object.prototype.hasOwnProperty.call(req.body, 'enrollment_date');
    const hasBt = Object.prototype.hasOwnProperty.call(req.body, 'billing_timing');
    const mf = hasMf ? parseMonthlyFee(monthly_fee) : null;
    const enrYmd = hasEnr ? parsePaymentStartDate(enrollment_date) : null;
    if (hasEnr && !enrYmd) {
      return res.status(400).json({ success: false, message: 'Dərslərə başlama tarixi düzgün deyil (YYYY-MM-DD)' });
    }
    const setParts = [`parent_name = NULLIF($1, '')`, `parent_phone = NULLIF($2, '')`];
    const vals = [pName, pPhone];
    let idx = 3;
    if (hasMf) {
      setParts.push(`monthly_fee = $${idx}::numeric`);
      vals.push(mf);
      idx += 1;
    }
    vals.push(studentId);
    const profUp = await db.query(
      `UPDATE student_profiles SET ${setParts.join(', ')} WHERE user_id = $${idx}`,
      vals
    );
    if (profUp.rowCount === 0) {
      await db.query(
        `INSERT INTO student_profiles (user_id, parent_name, parent_phone, monthly_fee)
         VALUES ($1, NULLIF($2, ''), NULLIF($3, ''), $4)`,
        [studentId, pName, pPhone, hasMf ? mf : null]
      );
    }

    if (hasEnr && enrYmd) {
      await db.query('UPDATE enrollments SET enrollment_start_date = $1::date WHERE id = $2', [enrYmd, enrollmentId]);
    }

    if (hasBt) {
      const { rows: enBt } = await db.query('SELECT billing_type FROM enrollments WHERE id = $1', [enrollmentId]);
      if (enBt[0]?.billing_type === 'monthly') {
        await db.query(`UPDATE enrollments SET billing_timing = $1::text WHERE id = $2`, [
          parseBillingTiming(billing_timing),
          enrollmentId,
        ]);
      }
    }

    const hasPp = Object.prototype.hasOwnProperty.call(req.body, 'payment_plan');
    if (hasPp) {
      const { rows: enPp } = await db.query('SELECT billing_type FROM enrollments WHERE id = $1', [enrollmentId]);
      if (enPp[0]?.billing_type === 'monthly') {
        await db.query(`UPDATE enrollments SET payment_plan = $1::text WHERE id = $2`, [
          parsePaymentPlan(payment_plan),
          enrollmentId,
        ]);
      }
    }

    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Müəllim/Admin: enrollment üzrə dərs cədvəli (dated lessons)
router.get('/enrollment/:enrollmentId/lessons', authenticate, authorize('admin', 'instructor'), async (req, res) => {
  try {
    const { enrollmentId } = req.params;
    const { rows: enr } = await db.query(
      'SELECT id, instructor_id, student_id FROM enrollments WHERE id = $1',
      [enrollmentId]
    );
    if (!enr[0]) return res.status(404).json({ success: false, message: 'Enrollment tapılmadı' });

    if (req.user.role === 'instructor' && !sameUuid(enr[0].instructor_id, req.user.id)) {
      return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
    }

    const { rows: lessons } = await db.query(
      `SELECT l.id, l.lesson_date, l.status, l.lesson_number, l.billing_cycle,
              e.lesson_times AS enrollment_lesson_times
       FROM lessons l
       JOIN enrollments e ON e.id = l.enrollment_id
       WHERE l.enrollment_id = $1
       ORDER BY l.lesson_date ASC`,
      [enrollmentId]
    );
    res.json({ success: true, lessons });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/:id/phone', authenticate, authorize('admin', 'instructor'), async (req, res) => {
  try {
    const { phone } = req.body;
    await db.query('UPDATE users SET phone = $1 WHERE id = $2', [phone, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/my/schedule', authenticate, authorize('student'), getMySchedule);
router.post('/my/prep-slots', authenticate, authorize('student'), addMyPrepSlots);
router.delete('/my/prep-slots/:id', authenticate, authorize('student'), deleteMyPrepSlot);

router.get(
  '/instructor/my-lessons',
  authenticate,
  authorize('instructor', 'admin'),
  getInstructorMyLessonsCalendar
);

router.get('/:id', authenticate, getStudent);

module.exports = router;
