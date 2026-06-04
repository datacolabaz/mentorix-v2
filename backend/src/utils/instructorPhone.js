const { canonicalStudentPhone, normalizePhoneDigits } = require('./studentPhone');

/**
 * Müəllim: 1 mobil nömrə = 1 aktiv müəllim hesabı (Google hesabından asılı olmayaraq).
 */
async function assertInstructorPhoneAvailable(dbConn, phoneCanon, excludeUserId = null) {
  const phone = canonicalStudentPhone(phoneCanon);
  if (!phone) {
    const err = new Error(
      'Mobil nömrə düzgün deyil. Nümunə: +994 50 123 45 67 (9 rəqəm, düzgün operator kodu)',
    );
    err.statusCode = 400;
    err.code = 'PHONE_INVALID';
    throw err;
  }

  const clean = normalizePhoneDigits(phone);
  const params = [clean];
  let excludeSql = '';
  if (excludeUserId) {
    params.push(excludeUserId);
    excludeSql = ` AND u.id <> $${params.length}::uuid`;
  }

  const { rows } = await dbConn.query(
    `SELECT u.id, u.email, u.full_name
     FROM users u
     WHERE u.role = 'instructor'
       AND u.is_active = TRUE
       AND regexp_replace(COALESCE(u.phone::text, ''), '[^0-9]', '', 'g') = $1
     ${excludeSql}
     LIMIT 1`,
    params,
  );

  if (rows[0]) {
    const err = new Error(
      'Bu mobil nömrə artıq başqa bir Mentorix müəllim hesabı ilə qeydiyyatdan keçib. Eyni nömrə ilə ikinci bir hesab açıla bilməz.',
    );
    err.statusCode = 409;
    err.code = 'INSTRUCTOR_PHONE_TAKEN';
    throw err;
  }

  return phone;
}

function instructorNeedsPhoneBinding(user) {
  if (!user || user.role !== 'instructor') return false;
  const phone = canonicalStudentPhone(user.phone);
  return !phone || !Boolean(user.phone_verified);
}

module.exports = {
  assertInstructorPhoneAvailable,
  instructorNeedsPhoneBinding,
  canonicalInstructorPhone: canonicalStudentPhone,
};
