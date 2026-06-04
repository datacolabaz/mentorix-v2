const { canonicalStudentPhone, normalizePhoneDigits } = require('./studentPhone');

/** Google OTP telefon təsdiqi — yalnız müəllim (tələbə telefon tələb etmir). */
const PHONE_VERIFY_ROLES = new Set(['instructor']);

function isGoogleAccountUser(user) {
  if (!user) return false;
  if (String(user.google_sub || '').trim()) return true;
  return String(user.auth_provider || '').toLowerCase() === 'google';
}

/** Google ilə giriş: bir dəfə OTP telefon təsdiqi (yalnız müəllim). */
function userNeedsPhoneVerification(user) {
  if (!user || !PHONE_VERIFY_ROLES.has(user.role)) return false;
  if (!isGoogleAccountUser(user)) return false;
  const phone = canonicalStudentPhone(user.phone);
  return !phone || !Boolean(user.phone_verified);
}

function instructorNeedsPhoneBinding(user) {
  return user?.role === 'instructor' && userNeedsPhoneVerification(user);
}

/**
 * @returns {null | { statusCode: number, body: object }}
 */
async function getPhoneVerificationBlock(dbConn, userId, opts = {}) {
  if (!userId) return null;
  const trigger = opts.trigger || 'default';
  const { rows } = await dbConn.query(
    `SELECT id, role, phone, phone_verified, google_sub, auth_provider
     FROM users WHERE id = $1::uuid AND is_active = TRUE LIMIT 1`,
    [userId],
  );
  const u = rows[0];
  if (!u || !userNeedsPhoneVerification(u)) return null;

  const message =
    u.role === 'instructor' && trigger === 'sms'
      ? 'SMS göndərmək üçün mobil nömrənizi bir dəfə OTP ilə təsdiqləyin.'
      : 'Google ilə daxil oldunuz. Davam etmək üçün mobil nömrənizi OTP ilə təsdiqləyin.';

  return {
    statusCode: 403,
    body: {
      success: false,
      message,
      code: 'PHONE_VERIFICATION_REQUIRED',
      needs_phone_verification: true,
      needs_instructor_phone: u.role === 'instructor',
    },
  };
}

async function getInstructorPhoneVerificationBlock(dbConn, instructorId) {
  return getPhoneVerificationBlock(dbConn, instructorId, { trigger: 'sms' });
}

function phoneVerificationHttpError(block) {
  const err = new Error(block.body.message);
  err.statusCode = block.statusCode;
  err.code = block.body.code;
  return err;
}

async function assertPhoneVerifiedForAction(dbConn, userId) {
  const block = await getPhoneVerificationBlock(dbConn, userId);
  if (block) throw phoneVerificationHttpError(block);
}

/**
 * Müəllim: 1 mobil nömrə = 1 aktiv müəllim hesabı (Google hesabından asılı olmayaraq).
 */
/**
 * Bir nömrə = bir aktiv hesab (müəllim / tələbə; profil telefonu daxil).
 */
async function assertAccountPhoneAvailable(dbConn, phoneCanon, excludeUserId = null) {
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
    `SELECT u.id, u.role, u.email, u.google_sub
     FROM users u
     LEFT JOIN student_profiles sp ON sp.user_id = u.id
     WHERE u.is_active = TRUE
       AND u.role IN ('instructor', 'student')
       AND (
         regexp_replace(COALESCE(u.phone::text, ''), '[^0-9]', '', 'g') = $1
         OR regexp_replace(COALESCE(sp.phone_number::text, ''), '[^0-9]', '', 'g') = $1
       )
     ${excludeSql}
     LIMIT 1`,
    params,
  );

  if (rows[0]) {
    const err = new Error(
      'Bu mobil nömrə artıq başqa bir Mentorix hesabına bağlıdır. Eyni nömrə ilə ikinci hesab açıla bilməz.',
    );
    err.statusCode = 409;
    err.code = 'PHONE_TAKEN';
    throw err;
  }

  return phone;
}

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

module.exports = {
  PHONE_VERIFY_ROLES,
  isGoogleAccountUser,
  userNeedsPhoneVerification,
  assertAccountPhoneAvailable,
  assertInstructorPhoneAvailable,
  instructorNeedsPhoneBinding,
  getPhoneVerificationBlock,
  getInstructorPhoneVerificationBlock,
  assertPhoneVerifiedForAction,
  canonicalInstructorPhone: canonicalStudentPhone,
};
