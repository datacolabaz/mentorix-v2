const db = require('../utils/db');
const {
  EMAIL_NOT_VERIFIED_MESSAGE,
  GOOGLE_LOGIN_REQUIRED_MESSAGE,
  isGoogleAuthUser,
  isUserEmailVerified,
  emailNotVerifiedBody,
  googleLoginRequiredBody,
} = require('../lib/emailAuthKind');

function respondEmailNotVerified(res) {
  return res.status(403).json(emailNotVerifiedBody());
}

/** DB-dən cari verification status (hər sessiya yoxlaması üçün). */
async function fetchUserAuthState(userId) {
  try {
    const { rows } = await db.query(
      `SELECT id, role, is_active, is_verified, role_selected, onboarding_completed, google_sub, auth_provider
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId],
    );
    return rows[0] || null;
  } catch {
    const { rows } = await db.query(
      `SELECT id, role, is_active, is_verified, role_selected
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId],
    );
    return rows[0] || null;
  }
}

/**
 * JWT sonrası: hesab aktivdir.
 * Google və ya şifrə ilə giriş email kodu tələb etmir.
 * @returns {Promise<object|null>} user row və ya null (cavab artıq göndərilib)
 */
async function ensureUserCanUseSession(userId, res) {
  const u = await fetchUserAuthState(userId);
  if (!u || u.is_active === false) {
    res.status(401).json({ success: false, message: 'Hesab tapılmadı və ya deaktivdir' });
    return null;
  }
  return u;
}

/** Token verməzdən əvvəl. Google hesabı email kodu tələb etmir. */
function guardEmailVerifiedBeforeToken(res, user) {
  if (isUserEmailVerified(user)) return true;
  respondEmailNotVerified(res);
  return false;
}

module.exports = {
  EMAIL_NOT_VERIFIED_MESSAGE,
  GOOGLE_LOGIN_REQUIRED_MESSAGE,
  isGoogleAuthUser,
  isUserEmailVerified,
  emailNotVerifiedBody,
  googleLoginRequiredBody,
  respondEmailNotVerified,
  fetchUserAuthState,
  ensureUserCanUseSession,
  guardEmailVerifiedBeforeToken,
};
