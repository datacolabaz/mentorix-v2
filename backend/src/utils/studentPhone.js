/** Tələbə əlaqə telefonu (SMS/WhatsApp) — müəllim auth telefonundan ayrıdır. */

const PHONE_NORM = "regexp_replace(COALESCE(phone::text, ''), '[^0-9]', '', 'g')";
const PROFILE_PHONE_NORM = "regexp_replace(COALESCE(phone_number::text, ''), '[^0-9]', '', 'g')";

/** SQL: tələbənin bildiriş üçün telefonu (profil üstünlüklü). */
const STUDENT_CONTACT_PHONE_SQL = `COALESCE(NULLIF(TRIM(sp.phone_number), ''), NULLIF(TRIM(u.phone), ''))`;

function normalizePhoneDigits(phone) {
  return String(phone || '').replace(/\D/g, '');
}

/** Azərbaycan mobil: +994 + 9 rəqəm. */
function canonicalStudentPhone(phone) {
  const clean = normalizePhoneDigits(phone);
  if (!clean) return null;
  if (clean.startsWith('994')) {
    const national = clean.slice(3);
    if (national.length !== 9) return null;
    return `+994${national}`;
  }
  if (clean.length === 9) return `+994${clean}`;
  if (clean.startsWith('0') && clean.length === 10) return `+994${clean.slice(1)}`;
  return null;
}

async function assertStudentPhoneAvailable(dbConn, phoneCanon, excludeUserId = null) {
  const clean = normalizePhoneDigits(phoneCanon);
  if (!clean) {
    const err = new Error('Telefon nömrəsi düzgün deyil');
    err.statusCode = 400;
    throw err;
  }
  const params = [clean];
  let excludeSql = '';
  if (excludeUserId) {
    params.push(excludeUserId);
    excludeSql = ` AND u.id <> $${params.length}`;
  }
  const { rows } = await dbConn.query(
    `SELECT u.id, u.full_name
     FROM users u
     LEFT JOIN student_profiles sp ON sp.user_id = u.id
     WHERE u.role = 'student'
       AND u.is_active = TRUE
       AND (
         regexp_replace(COALESCE(u.phone::text, ''), '[^0-9]', '', 'g') = $1
         OR regexp_replace(COALESCE(sp.phone_number::text, ''), '[^0-9]', '', 'g') = $1
       )
     ${excludeSql}
     LIMIT 1`,
    params,
  );
  if (rows[0]) {
    const err = new Error('Bu telefon nömrəsi artıq başqa tələbəyə bağlıdır');
    err.statusCode = 409;
    throw err;
  }
}

async function upsertStudentContactPhone(dbConn, userId, phoneCanon, opts = {}) {
  const phone = canonicalStudentPhone(phoneCanon);
  if (!phone) {
    const err = new Error('Telefon nömrəsi düzgün deyil (+994...)');
    err.statusCode = 400;
    throw err;
  }
  await assertStudentPhoneAvailable(dbConn, phone, userId);

  const sets = ['phone = $1'];
  const vals = [phone];
  let idx = 2;
  if (opts.full_name != null && String(opts.full_name).trim()) {
    sets.push(`full_name = $${idx}`);
    vals.push(String(opts.full_name).trim());
    idx += 1;
  }
  vals.push(userId);
  await dbConn.query(`UPDATE users SET ${sets.join(', ')} WHERE id = $${idx}`, vals);

  const pr = await dbConn.query(
    `UPDATE student_profiles SET phone_number = $1 WHERE user_id = $2`,
    [phone, userId],
  );
  if (pr.rowCount === 0) {
    await dbConn.query(
      `INSERT INTO student_profiles (user_id, phone_number) VALUES ($1, $2)`,
      [userId, phone],
    );
  }
  return phone;
}

module.exports = {
  PHONE_NORM,
  PROFILE_PHONE_NORM,
  STUDENT_CONTACT_PHONE_SQL,
  normalizePhoneDigits,
  canonicalStudentPhone,
  assertStudentPhoneAvailable,
  upsertStudentContactPhone,
};
