const db = require('../utils/db');

const EMAIL_NOT_VERIFIED_MESSAGE =
  'E-poçt təsdiqlənməyib. Zəhmət olmasa e-poçtunuzdakı təsdiq linkinə klik edin və ya təsdiq kodunu daxil edin.';

function isUserEmailVerified(user) {
  if (!user) return false;
  return user.is_verified !== false;
}

function emailNotVerifiedBody() {
  return {
    success: false,
    code: 'EMAIL_NOT_VERIFIED',
    message: EMAIL_NOT_VERIFIED_MESSAGE,
  };
}

function respondEmailNotVerified(res) {
  return res.status(403).json(emailNotVerifiedBody());
}

/** DB-dən cari verification status (hər sessiya yoxlaması üçün). */
async function fetchUserAuthState(userId) {
  const { rows } = await db.query(
    `SELECT id, role, is_active, is_verified, role_selected
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [userId],
  );
  return rows[0] || null;
}

/**
 * JWT sonrası və ya token verməzdən əvvəl: hesab aktiv və email təsdiqlənib.
 * @returns {Promise<object|null>} user row və ya null (cavab artıq göndərilib)
 */
async function ensureUserCanUseSession(userId, res) {
  const u = await fetchUserAuthState(userId);
  if (!u || u.is_active === false) {
    res.status(401).json({ success: false, message: 'Hesab tapılmadı və ya deaktivdir' });
    return null;
  }
  if (!isUserEmailVerified(u)) {
    respondEmailNotVerified(res);
    return null;
  }
  return u;
}

/** Token verməzdən əvvəl (login callback-ləri). */
function guardEmailVerifiedBeforeToken(res, user) {
  if (isUserEmailVerified(user)) return true;
  respondEmailNotVerified(res);
  return false;
}

module.exports = {
  EMAIL_NOT_VERIFIED_MESSAGE,
  isUserEmailVerified,
  emailNotVerifiedBody,
  respondEmailNotVerified,
  fetchUserAuthState,
  ensureUserCanUseSession,
  guardEmailVerifiedBeforeToken,
};
