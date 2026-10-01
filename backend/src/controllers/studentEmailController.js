const db = require('../utils/db');

function normUuid(id) {
  return String(id).trim().toLowerCase().replace(/-/g, '');
}

function sameUuid(a, b) {
  if (a == null || b == null) return false;
  return String(a).replace(/-/g, '').toLowerCase() === String(b).replace(/-/g, '').toLowerCase();
}

function canonicalStudentEmail(email) {
  const raw = String(email || '').trim().toLowerCase();
  if (!raw) return null;
  if (raw.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return null;
  return raw;
}

/**
 * PATCH /students/:id/email
 * Admin/instructor: fix typos / replace reserved email before Google merge.
 *
 * Security rule:
 * - If student already has google_sub (Google linked), block email changes.
 */
async function patchStudentEmail(req, res) {
  try {
    const studentId = req.params.id;
    if (!studentId) return res.status(400).json({ success: false, message: 'Student id tələb olunur' });

    const rawEmail = req.body?.email;
    if (rawEmail === undefined) {
      return res.status(400).json({
        success: false,
        message: 'email sahəsi tələb olunur (null/boş string ilə silmək üçün explicit göndərin)',
      });
    }

    const emailCanon = canonicalStudentEmail(rawEmail);
    if (String(rawEmail || '').trim() && !emailCanon) {
      return res.status(400).json({ success: false, message: 'Email formatı düzgün deyil' });
    }

    const instructorId = req.user.role === 'admin' ? req.body.instructor_id : req.user.id;
    if (req.user.role === 'admin' && !instructorId) {
      return res.status(400).json({ success: false, message: 'Admin üçün instructor_id tələb olunur' });
    }
    const ni = normUuid(instructorId);

    if (req.user.role === 'instructor') {
      const { rows: enrOk } = await db.query(
        `SELECT 1
         FROM enrollments e
         WHERE e.student_id = $1::uuid
           AND e.status = 'active'
           AND REPLACE(LOWER(TRIM(e.instructor_id::text)), '-', '') = $2
         LIMIT 1`,
        [studentId, ni]
      );
      if (!enrOk[0]) {
        return res.status(403).json({ success: false, message: 'Bu tələbəni redaktə etmək üçün icazə yoxdur' });
      }
    }

    const { rows: urows } = await db.query(
      `SELECT id, role, email, google_sub, account_status
       FROM users
       WHERE id = $1::uuid
       LIMIT 1`,
      [studentId]
    );
    const u = urows[0];
    if (!u || u.role !== 'student') {
      return res.status(404).json({ success: false, message: 'Tələbə tapılmadı' });
    }

    const googleLinked = u.google_sub != null && String(u.google_sub).trim() !== '';
    if (googleLinked) {
      return res.status(403).json({
        success: false,
        message: 'Bu tələbə Google ilə bağlıdır — email dəyişikliyi təhlükəsizlik üçün bloklanıb',
      });
    }

    if (emailCanon) {
      const { rows: clash } = await db.query(
        `SELECT id
         FROM users
         WHERE is_active = TRUE
           AND id <> $1::uuid
           AND email IS NOT NULL
           AND LOWER(TRIM(email)) = LOWER(TRIM($2))
         LIMIT 1`,
        [studentId, emailCanon]
      );
      if (clash[0]?.id) {
        return res.status(409).json({ success: false, message: 'Bu email artıq başqa hesaba bağlıdır' });
      }
    }

    const nextStatus = emailCanon ? 'pending_google' : 'active';

    try {
      const { rows: updated } = await db.query(
        `UPDATE users
         SET email = $2,
             account_status = $3
         WHERE id = $1::uuid
         RETURNING id, full_name, email, role, phone, account_status`,
        [studentId, emailCanon, nextStatus]
      );
      return res.json({ success: true, user: updated[0] });
    } catch (e) {
      if (e?.code === '23505') {
        return res.status(409).json({ success: false, message: 'Bu email artıq mövcuddur' });
      }
      throw e;
    }
  } catch (err) {
    const st = err.statusCode || 500;
    res.status(st).json({ success: false, message: err.message });
  }
}

/**
 * PATCH /students/:id/parent-email  { parent_email: string | null }
 * Optional parent contact address on the student profile. Only the student's teacher (active
 * enrollment) or an admin may change it; null / '' clears it. A new address clears the opt-out.
 */
async function patchStudentParentEmail(req, res) {
  try {
    const studentId = String(req.params.id || '').trim();
    if (!/^[0-9a-f-]{32,36}$/i.test(studentId)) {
      return res.status(400).json({ success: false, message: 'Student id tələb olunur' });
    }
    const raw = req.body?.parent_email;
    if (raw === undefined) {
      return res.status(400).json({ success: false, message: 'parent_email sahəsi tələb olunur' });
    }
    const parentEmail = canonicalStudentEmail(raw);
    if (String(raw || '').trim() && !parentEmail) {
      return res.status(400).json({ success: false, code: 'INVALID_PARENT_EMAIL', message: 'Valideyn emailinin formatı düzgün deyil' });
    }

    if (req.user.role !== 'admin') {
      const { rows: enrOk } = await db.query(
        `SELECT 1
         FROM enrollments e
         WHERE e.student_id = $1::uuid
           AND e.status = 'active'
           AND REPLACE(LOWER(TRIM(e.instructor_id::text)), '-', '') = $2
         LIMIT 1`,
        [studentId, normUuid(req.user.id)],
      );
      if (!enrOk[0]) {
        return res.status(403).json({ success: false, message: 'Bu tələbəni redaktə etmək üçün icazə yoxdur' });
      }
    }

    const { rows: urows } = await db.query(`SELECT id, role FROM users WHERE id = $1::uuid LIMIT 1`, [studentId]);
    if (!urows[0] || urows[0].role !== 'student') {
      return res.status(404).json({ success: false, message: 'Tələbə tapılmadı' });
    }

    const { rows: updated } = await db.query(
      `UPDATE student_profiles
       SET parent_email_opt_out_at = CASE
             WHEN parent_email IS NOT DISTINCT FROM $2 THEN parent_email_opt_out_at
             ELSE NULL
           END,
           parent_email = $2
       WHERE user_id = $1::uuid
       RETURNING parent_email`,
      [studentId, parentEmail],
    );
    if (!updated[0] && parentEmail) {
      await db.query(`INSERT INTO student_profiles (user_id, parent_email) VALUES ($1::uuid, $2)`, [studentId, parentEmail]);
    }
    return res.json({ success: true, parent_email: parentEmail });
  } catch (err) {
    const st = err.statusCode || 500;
    res.status(st).json({ success: false, message: st === 500 ? 'Server xətası' : err.message });
  }
}

module.exports = {
  patchStudentEmail,
  patchStudentParentEmail,
  canonicalStudentEmail,
  // exported for tests / reuse
  sameUuid,
  normUuid,
};
