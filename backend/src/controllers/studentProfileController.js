const db = require('../utils/db');
const {
  canonicalStudentPhone,
  STUDENT_CONTACT_PHONE_SQL,
  upsertStudentContactPhone,
} = require('../utils/studentPhone');
const { sendStudentProfileCompletionEmail, frontendBaseUrl } = require('../services/studentNotificationEmailService');

function normUuid(id) {
  return String(id || '').trim().toLowerCase().replace(/-/g, '');
}

function sameUuid(a, b) {
  return normUuid(a) === normUuid(b);
}

function splitFullName(full) {
  const t = String(full || '').trim();
  if (!t) return { first_name: '', last_name: '' };
  const i = t.indexOf(' ');
  if (i < 0) return { first_name: t, last_name: '' };
  return { first_name: t.slice(0, i).trim(), last_name: t.slice(i + 1).trim() };
}

async function getStudentContactPhone(studentId) {
  const { rows } = await db.query(
    `SELECT ${STUDENT_CONTACT_PHONE_SQL} AS phone
     FROM users u
     LEFT JOIN student_profiles sp ON sp.user_id = u.id
     WHERE u.id = $1::uuid LIMIT 1`,
    [studentId],
  );
  return canonicalStudentPhone(rows[0]?.phone);
}

async function resolveProfileCompletionUrl(studentId, instructorId) {
  const { rows: examRows } = await db.query(
    `SELECT ear.exam_id
     FROM exam_access_requests ear
     WHERE ear.student_id = $1::uuid
       AND ear.instructor_id = $2::uuid
       AND UPPER(TRIM(ear.status)) IN ('PENDING', 'APPROVED', 'REJECTED')
     ORDER BY ear.created_at DESC
     LIMIT 1`,
    [studentId, instructorId],
  );
  if (examRows[0]?.exam_id) {
    return `${frontendBaseUrl()}/exam/${encodeURIComponent(String(examRows[0].exam_id))}`;
  }

  const { rows: joinRows } = await db.query(
    `SELECT ig.invitation_code, ig.join_code
     FROM student_join_requests sjr
     JOIN instructor_groups ig ON ig.id = sjr.group_id
     WHERE sjr.student_id = $1::uuid
       AND sjr.instructor_id = $2::uuid
       AND UPPER(TRIM(sjr.status)) IN ('PENDING', 'APPROVED')
     ORDER BY sjr.created_at DESC
     LIMIT 1`,
    [studentId, instructorId],
  );
  const code = String(joinRows[0]?.invitation_code || joinRows[0]?.join_code || '')
    .trim()
    .toUpperCase();
  if (code) {
    return `${frontendBaseUrl()}/join/${encodeURIComponent(code)}`;
  }

  return `${frontendBaseUrl()}/student`;
}

/** Tələbə: ad, soyad, telefon — sorğu göndərmədən əvvəl */
const patchMyContactProfile = async (req, res) => {
  try {
    const firstName = String(req.body?.first_name || '').trim();
    const lastName = String(req.body?.last_name || '').trim();
    const phoneRaw = req.body?.phone ?? req.body?.phone_number;
    if (!firstName) {
      return res.status(400).json({ success: false, message: 'Ad tələb olunur' });
    }
    if (!lastName) {
      return res.status(400).json({ success: false, message: 'Soyad tələb olunur' });
    }
    const phoneCanon = canonicalStudentPhone(phoneRaw);
    if (!phoneCanon) {
      return res.status(400).json({
        success: false,
        message: 'Telefon düzgün deyil (+994 və 9 rəqəm, məs. 50 123 45 67)',
        code: 'PHONE_REQUIRED',
      });
    }

    const full_name = `${firstName} ${lastName}`.trim();
    await db.transaction(async (client) => {
      await upsertStudentContactPhone(client, req.user.id, phoneCanon, { full_name });
    });

    const { rows } = await db.query(
      `SELECT id, full_name, email, phone, role FROM users WHERE id = $1 LIMIT 1`,
      [req.user.id],
    );
    const u = rows[0] || {};
    res.json({
      success: true,
      message: 'Profil yeniləndi',
      user: {
        id: u.id,
        full_name: u.full_name,
        email: u.email,
        phone: u.phone,
        role: u.role,
      },
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message, code: err.code });
  }
};

/** Müəllim: telefonsuz tələbəyə profil tamamlama linki (email) */
const sendEnrollmentProfileCompletionEmail = async (req, res) => {
  try {
    const { enrollmentId } = req.params;
    const { rows: enrRows } = await db.query(
      `SELECT e.id, e.instructor_id, e.student_id, e.status,
              u.full_name, u.email,
              iu.full_name AS instructor_name
       FROM enrollments e
       JOIN users u ON u.id = e.student_id
       JOIN users iu ON iu.id = e.instructor_id
       WHERE e.id = $1 AND (e.deleted_at IS NULL)`,
      [enrollmentId],
    );
    const enr = enrRows[0];
    if (!enr) {
      return res.status(404).json({ success: false, message: 'Qeydiyyat tapılmadı' });
    }
    if (req.user.role === 'instructor' && !sameUuid(enr.instructor_id, req.user.id)) {
      return res.status(403).json({ success: false, message: 'Bu qeydiyyata icazəniz yoxdur' });
    }

    const phone = await getStudentContactPhone(enr.student_id);
    if (phone) {
      return res.status(400).json({
        success: false,
        message: 'Tələbənin mobil nömrəsi artıq qeydiyə alınıb — quraşdırmanı davam etdirə bilərsiniz.',
      });
    }

    const email = String(enr.email || '').trim();
    if (!email || !email.includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'Tələbənin Gmail ünvanı yoxdur — əvvəlcə Google ilə qeydiyyat lazımdır.',
      });
    }

    const completionUrl = await resolveProfileCompletionUrl(enr.student_id, enr.instructor_id);
    const emailResult = await sendStudentProfileCompletionEmail({
      userId: enr.student_id,
      emailOverride: email,
      completionUrl,
      instructorName: enr.instructor_name,
      studentName: enr.full_name,
    });

    if (!emailResult?.ok) {
      return res.status(502).json({
        success: false,
        message: emailResult?.error || 'Email göndərilmədi (konfiqurasiya yoxlanılsın)',
      });
    }

    res.json({
      success: true,
      message: `${email} ünvanına profil tamamlama linki göndərildi. Tələbə linkə daxil olub məlumatları doldurandan sonra sorğu müəllimə gedəcək.`,
      completion_url: completionUrl,
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

/** Sorğu / təsdiq üçün profil tamamlığı */
async function assertStudentProfileComplete(studentId) {
  const phone = await getStudentContactPhone(studentId);
  if (!phone) {
    const err = new Error(
      'Tələbənin mobil nömrəsi qeydiyə alınmayıb. Tələbəyə profil tamamlama linki göndərin.',
    );
    err.statusCode = 400;
    err.code = 'STUDENT_PROFILE_INCOMPLETE';
    throw err;
  }
  const { rows } = await db.query(
    `SELECT full_name FROM users WHERE id = $1::uuid LIMIT 1`,
    [studentId],
  );
  const { first_name, last_name } = splitFullName(rows[0]?.full_name);
  if (!first_name || !last_name) {
    const err = new Error('Tələbənin ad və soyadı tam deyil — profil tamamlama linki göndərin.');
    err.statusCode = 400;
    err.code = 'STUDENT_PROFILE_INCOMPLETE';
    throw err;
  }
  return { phone, full_name: rows[0]?.full_name };
}

module.exports = {
  patchMyContactProfile,
  sendEnrollmentProfileCompletionEmail,
  assertStudentProfileComplete,
  getStudentContactPhone,
  resolveProfileCompletionUrl,
};
