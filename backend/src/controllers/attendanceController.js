const db = require('../utils/db');
const { sendSms } = require('../services/smsService');

function normUuid(id) {
  return String(id || '').trim().toLowerCase().replace(/-/g, '');
}

function sameUuid(a, b) {
  if (a == null || b == null) return false;
  return normUuid(a) === normUuid(b);
}

/** enrollment_lessons.starts_at → YYYY-MM-DD (Asia/Baku), UI ilə uyğun */
function lessonYmdBaku(startsAt) {
  if (!startsAt) return null;
  const d = new Date(startsAt);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Baku',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function parseYmd(v) {
  if (v === undefined || v === null || v === '') return null;
  const s = String(v).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

function billingLimit(billingType) {
  if (billingType === '8_lessons') return 8;
  if (billingType === '12_lessons') return 12;
  return null;
}

function packTriggerAt(limit) {
  if (limit === 8) return 7;
  if (limit === 12) return 11;
  return null;
}

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
      `SELECT e.*, COALESCE(e.pack_reminder_sent_cycle, 0) AS pack_reminder_sent_cycle,
              ip.alert_lessons_before, ip.billing_type AS instr_billing,
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

    if (enrollment.billing_type === 'monthly') {
      return res.status(400).json({
        success: false,
        message: 'Aylıq paket üçün davamiyyəti “Davamiyyət” səhifəsindəki aylıq cədvəldən qeyd edin.',
      });
    }

    const lessonNum = enrollment.lesson_count + 1;

    await db.query(
      `INSERT INTO attendance (enrollment_id, billing_cycle, lesson_number, date, attended, session_score, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (enrollment_id, billing_cycle, lesson_number)
       DO UPDATE SET attended = EXCLUDED.attended, date = EXCLUDED.date, session_score = EXCLUDED.session_score, notes = EXCLUDED.notes`,
      [enrollment_id, enrollment.billing_cycle || 1, lessonNum, date, Boolean(attended), sessionScoreSql, notes || null]
    );

    // Hər dərs qeydi lesson_count-u artırır (iştirak etdi / etmədi fərq etmir)
    await db.query(
      'UPDATE enrollments SET lesson_count = lesson_count + 1 WHERE id = $1',
      [enrollment_id]
    );

    const limit = billingLimit(enrollment.billing_type);
    const triggerAt = packTriggerAt(limit);
    const alreadySent = Number(enrollment.pack_reminder_sent_cycle || 0) >= (Number(enrollment.billing_cycle) || 1);

    if (attended && limit && triggerAt && !alreadySent && lessonNum === triggerAt) {
      const targetPhone = enrollment.parent_phone || enrollment.student_phone;
      if (targetPhone) {
        await sendSms({
          instructorId: enrollment.instructor_id,
          phone: targetPhone,
          message:
            'Mentorix: Növbəti dərsiniz paketinizin son dərsidir. Davam etmək üçün ödənişi nəzərə alın.',
        });
        await db.query(
          `UPDATE enrollments
           SET pack_reminder_sent_cycle = billing_cycle
           WHERE id = $1`,
          [enrollment_id]
        );
      }
    }

    // 8/12 paketi bitəndə növbəti billing period açılsın
    if (limit && lessonNum >= limit) {
      await db.query(
        `UPDATE enrollments
         SET billing_cycle = billing_cycle + 1,
             lesson_count = 0
         WHERE id = $1`,
        [enrollment_id]
      );
    }

    res.json({ success: true, lesson_number: lessonNum });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** Müəllim UI: cari billing cycle üçün 1..limit dərs siyahısı + mövcud qeydlər */
const getAttendancePeriod = async (req, res) => {
  try {
    const { enrollment_id } = req.params;
    const { rows: enRows } = await db.query(
      `SELECT e.id, e.student_id, e.instructor_id, e.billing_type, e.lesson_count, e.billing_cycle,
              e.lesson_weekdays, e.lesson_times, e.enrollment_start_date, e.enrolled_at,
              u.full_name AS student_name
       FROM enrollments e
       JOIN users u ON u.id = e.student_id
       WHERE e.id = $1`,
      [enrollment_id]
    );
    const enrollment = enRows[0];
    if (!enrollment) return res.status(404).json({ success: false, message: 'Tapılmadı' });

    const enStudent = enrollment.student_id;
    const enInstr = enrollment.instructor_id;
    if (req.user.role === 'student' && String(enStudent) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
    }
    if (
      req.user.role === 'instructor' &&
      String(enInstr).replace(/-/g, '').toLowerCase() !== String(req.user.id).replace(/-/g, '').toLowerCase()
    ) {
      return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
    }

    const cycle = Number(enrollment.billing_cycle) || 1;
    const limit = billingLimit(enrollment.billing_type);

    const { rows: attendance } = await db.query(
      `SELECT id, billing_cycle, lesson_number, date, attended, notes, created_at
       FROM attendance
       WHERE enrollment_id = $1 AND billing_cycle = $2
       ORDER BY lesson_number`,
      [enrollment_id, cycle]
    );

    const { rows: lessons } = await db.query(
      `SELECT lesson_number, starts_at, status
       FROM enrollment_lessons
       WHERE enrollment_id = $1 AND billing_cycle = $2
       ORDER BY lesson_number`,
      [enrollment_id, cycle]
    );

    res.json({
      success: true,
      enrollment: {
        id: enrollment.id,
        student_name: enrollment.student_name,
        billing_type: enrollment.billing_type,
        billing_cycle: cycle,
        lesson_count: enrollment.lesson_count || 0,
        lesson_limit: limit,
        lesson_weekdays: enrollment.lesson_weekdays,
        lesson_times: enrollment.lesson_times,
        enrollment_start_date: enrollment.enrollment_start_date,
        enrolled_at: enrollment.enrolled_at,
      },
      attendance,
      lessons,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** Müəllim UI: bir dərsi attended/not-attended olaraq upsert et */
const upsertAttendanceLesson = async (req, res) => {
  try {
    const { enrollment_id } = req.params;
    const { lesson_number, attended, date, notes } = req.body;

    const ln = parseInt(String(lesson_number), 10);
    if (!Number.isFinite(ln) || ln < 1 || ln > 999) {
      return res.status(400).json({ success: false, message: 'lesson_number yanlışdır' });
    }

    const { rows: enRows } = await db.query(
      `SELECT e.id, e.student_id, e.instructor_id, e.billing_type, e.billing_cycle,
              COALESCE(e.pack_reminder_sent_cycle, 0) AS pack_reminder_sent_cycle
       FROM enrollments e
       WHERE e.id = $1`,
      [enrollment_id]
    );
    const enrollment = enRows[0];
    if (!enrollment) return res.status(404).json({ success: false, message: 'Tapılmadı' });

    if (
      req.user.role === 'instructor' &&
      String(enrollment.instructor_id).replace(/-/g, '').toLowerCase() !== String(req.user.id).replace(/-/g, '').toLowerCase()
    ) {
      return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
    }

    const cycle = Number(enrollment.billing_cycle) || 1;
    const limit = billingLimit(enrollment.billing_type);
    const triggerAt = packTriggerAt(limit);
    const alreadySent = Number(enrollment.pack_reminder_sent_cycle || 0) >= cycle;
    if (limit && ln > limit) {
      return res.status(400).json({ success: false, message: `Bu paket üçün maksimum ${limit} dərs var` });
    }

    const d = date || new Date().toISOString().slice(0, 10);

    // count before (to avoid resending alerts on edits)
    const { rows: beforeRows } = await db.query(
      `SELECT COUNT(*)::int AS n FROM attendance WHERE enrollment_id = $1 AND billing_cycle = $2`,
      [enrollment_id, cycle]
    );
    const beforeN = beforeRows[0]?.n || 0;

    await db.query(
      `INSERT INTO attendance (enrollment_id, billing_cycle, lesson_number, date, attended, notes)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (enrollment_id, billing_cycle, lesson_number)
       DO UPDATE SET attended = EXCLUDED.attended, date = EXCLUDED.date, notes = EXCLUDED.notes`,
      [enrollment_id, cycle, ln, d, Boolean(attended), notes || null]
    );

    // lesson_count = bu cycle-da neçə dərs qeyd olunub
    const { rows: c } = await db.query(
      `SELECT COUNT(*)::int AS n FROM attendance WHERE enrollment_id = $1 AND billing_cycle = $2`,
      [enrollment_id, cycle]
    );
    const n = c[0]?.n || 0;
    await db.query('UPDATE enrollments SET lesson_count = $2 WHERE id = $1', [enrollment_id, n]);

    // match lesson record (if generated)
    await db.query(
      `UPDATE enrollment_lessons
       SET status = $4, marked_at = NOW()
       WHERE enrollment_id = $1 AND billing_cycle = $2 AND lesson_number = $3`,
      [enrollment_id, cycle, ln, Boolean(attended) ? 'done' : 'absent']
    );

    // Pack reminder: 8-pack at 7 completed lessons, 12-pack at 11 completed lessons (once per cycle).
    if (attended && limit && triggerAt && !alreadySent && beforeN < triggerAt && n >= triggerAt) {
      const { rows: [info] } = await db.query(
        `SELECT e.instructor_id, u.full_name AS student_name, u.phone AS student_phone,
                COALESCE(NULLIF(TRIM(sp.parent_phone), ''), pu.phone) AS parent_phone
         FROM enrollments e
         JOIN users u ON u.id = e.student_id
         LEFT JOIN student_profiles sp ON sp.user_id = e.student_id
         LEFT JOIN users pu ON pu.id = sp.parent_id
         WHERE e.id = $1`,
        [enrollment_id]
      );
      const targetPhone = info?.parent_phone || info?.student_phone;
      if (targetPhone) {
        await sendSms({
          instructorId: info.instructor_id,
          phone: targetPhone,
          message:
            'Mentorix: Növbəti dərsiniz paketinizin son dərsidir. Davam etmək üçün ödənişi nəzərə alın.',
        });
        await db.query(
          `UPDATE enrollments
           SET pack_reminder_sent_cycle = billing_cycle
           WHERE id = $1`,
          [enrollment_id]
        );
      }
    }

    // Paket bitəndə avtomatik növbəti cycle-a KEÇMİRİK.
    // Yeni paket yalnız müəllim ödənişi təsdiqləyəndə (payments) aktivləşir.

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** Müəllim: tarix aralığında planlaşdırılmış dərsləri toplu "Gəldi/Gəlmədi" qeyd edir (8/12 paket, cari dövr) */
const bulkFillAttendancePeriod = async (req, res) => {
  try {
    const { enrollment_id, date_from, date_to, notes } = req.body;
    const attended = req.body.attended !== false;

    const df = parseYmd(date_from);
    const dt = parseYmd(date_to);
    if (!enrollment_id || !df || !dt || df > dt) {
      return res.status(400).json({
        success: false,
        message: 'enrollment_id, date_from və date_to (YYYY-MM-DD) düzgün göndərilməlidir',
      });
    }
    const spanDays = Math.ceil(
      (new Date(`${dt}T12:00:00Z`).getTime() - new Date(`${df}T12:00:00Z`).getTime()) / 86400000
    );
    if (spanDays > 620) {
      return res.status(400).json({ success: false, message: 'Tarix aralığı çox uzundur (maks. ~20 ay)' });
    }

    const { rows: enRows } = await db.query(
      `SELECT e.id, e.student_id, e.instructor_id, e.billing_type, e.billing_cycle, e.enrollment_start_date
       FROM enrollments e WHERE e.id = $1`,
      [enrollment_id]
    );
    const enrollment = enRows[0];
    if (!enrollment) return res.status(404).json({ success: false, message: 'Tapılmadı' });
    if (req.user.role === 'instructor' && !sameUuid(enrollment.instructor_id, req.user.id)) {
      return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
    }

    const limit = billingLimit(enrollment.billing_type);
    if (!limit) {
      return res.status(400).json({
        success: false,
        message: 'Toplu davamiyyət yalnız 8 və ya 12 dərs paketi üçün mövcuddur',
      });
    }

    const anchorYmd = parseYmd(enrollment.enrollment_start_date);
    let effFrom = df;
    if (anchorYmd && effFrom < anchorYmd) effFrom = anchorYmd;
    if (effFrom > dt) {
      return res.json({
        success: true,
        updated: 0,
        message: 'Seçilmiş aralıq ödəniş başlanğıcından əvvəldir — dərs yoxdur',
      });
    }

    const cycle = Number(enrollment.billing_cycle) || 1;
    const { rows: beforeRows } = await db.query(
      `SELECT COUNT(*)::int AS n FROM attendance WHERE enrollment_id = $1 AND billing_cycle = $2`,
      [enrollment_id, cycle]
    );
    const beforeN = beforeRows[0]?.n || 0;
    const { rows: planned } = await db.query(
      `SELECT lesson_number, starts_at
       FROM enrollment_lessons
       WHERE enrollment_id = $1 AND billing_cycle = $2
       ORDER BY lesson_number`,
      [enrollment_id, cycle]
    );

    const noteBase = notes != null && String(notes).trim() !== '' ? String(notes).trim() : 'Toplu qeyd';
    const rowNote = `[Toplu davamiyyət ${effFrom}–${dt}] ${noteBase}`.slice(0, 500);

    const toUpsert = [];
    for (const row of planned) {
      const y = lessonYmdBaku(row.starts_at);
      if (!y) continue;
      if (y >= effFrom && y <= dt) {
        toUpsert.push({ lesson_number: Number(row.lesson_number), date: y });
      }
    }

    if (toUpsert.length === 0) {
      return res.json({
        success: true,
        updated: 0,
        message: 'Seçilmiş tarix aralığında planlaşdırılmış dərs tapılmadı',
      });
    }

    let afterN = 0;
    await db.transaction(async (client) => {
      for (const u of toUpsert) {
        await client.query(
          `INSERT INTO attendance (enrollment_id, billing_cycle, lesson_number, date, attended, notes)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (enrollment_id, billing_cycle, lesson_number)
           DO UPDATE SET attended = EXCLUDED.attended, date = EXCLUDED.date, notes = EXCLUDED.notes`,
          [enrollment_id, cycle, u.lesson_number, u.date, Boolean(attended), rowNote]
        );
        await client.query(
          `UPDATE enrollment_lessons
           SET status = $4, marked_at = NOW()
           WHERE enrollment_id = $1 AND billing_cycle = $2 AND lesson_number = $3`,
          [enrollment_id, cycle, u.lesson_number, Boolean(attended) ? 'done' : 'absent']
        );
      }

      const { rows: c } = await client.query(
        `SELECT COUNT(*)::int AS n FROM attendance WHERE enrollment_id = $1 AND billing_cycle = $2`,
        [enrollment_id, cycle]
      );
      const n = c[0]?.n || 0;
      afterN = n;
      await client.query('UPDATE enrollments SET lesson_count = $2 WHERE id = $1', [enrollment_id, n]);

      if (limit && n >= limit) {
        await client.query(
          `UPDATE enrollments
           SET billing_cycle = billing_cycle + 1,
               lesson_count = 0
           WHERE id = $1`,
          [enrollment_id]
        );
      }
    });

    // Pack reminder: 8-pack at 7 completed lessons, 12-pack at 11 completed lessons (once per cycle).
    const triggerAt = packTriggerAt(limit);
    const { rows: [enInfo] } = await db.query(
      `SELECT billing_cycle, COALESCE(pack_reminder_sent_cycle, 0) AS pack_reminder_sent_cycle
       FROM enrollments
       WHERE id = $1`,
      [enrollment_id]
    );
    const cycleNow = Number(enInfo?.billing_cycle) || cycle;
    const alreadySent = Number(enInfo?.pack_reminder_sent_cycle || 0) >= cycleNow;

    if (attended && limit && triggerAt && !alreadySent && beforeN < triggerAt && afterN >= triggerAt) {
      const { rows: [info] } = await db.query(
        `SELECT e.instructor_id, u.full_name AS student_name, u.phone AS student_phone,
                COALESCE(NULLIF(TRIM(sp.parent_phone), ''), pu.phone) AS parent_phone
         FROM enrollments e
         JOIN users u ON u.id = e.student_id
         LEFT JOIN student_profiles sp ON sp.user_id = e.student_id
         LEFT JOIN users pu ON pu.id = sp.parent_id
         WHERE e.id = $1`,
        [enrollment_id]
      );
      const targetPhone = info?.parent_phone || info?.student_phone;
      if (targetPhone) {
        await sendSms({
          instructorId: info.instructor_id,
          phone: targetPhone,
          message:
            'Mentorix: Növbəti dərsiniz paketinizin son dərsidir. Davam etmək üçün ödənişi nəzərə alın.',
        });
        await db.query(
          `UPDATE enrollments
           SET pack_reminder_sent_cycle = billing_cycle
           WHERE id = $1`,
          [enrollment_id]
        );
      }
    }

    res.json({ success: true, updated: toUpsert.length });
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
      'SELECT * FROM attendance WHERE enrollment_id=$1 ORDER BY billing_cycle, lesson_number',
      [enrollment_id]
    );
    res.json({ success: true, attendance: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  markAttendance,
  getAttendance,
  getAttendancePeriod,
  upsertAttendanceLesson,
  bulkFillAttendancePeriod,
};
