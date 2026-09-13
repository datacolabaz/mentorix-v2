/**
 * Google identity helpers: find existing users without leaking Postgres errors,
 * and recover from unique-constraint races on google_sub / email.
 */

const GOOGLE_USER_COLUMNS = `
  id, full_name, email, role, phone, phone_verified, phone_verified_at,
  auth_provider, google_sub, account_status, is_active, is_verified,
  role_selected, persona, persona_profile, onboarding_completed
`;

const ACCOUNT_EXISTS_AZ =
  'Bu Google hesabı ilə artıq qeydiyyat mövcuddur. Daxil olun.';
const GENERIC_GOOGLE_AUTH_AZ = 'Google girişi uğursuz oldu. Yenidən cəhd edin.';

function isPgUniqueViolation(err) {
  if (!err) return false;
  if (String(err.code || '') === '23505') return true;
  return /duplicate key value violates unique constraint/i.test(String(err.message || ''));
}

function constraintHint(err) {
  return `${err?.constraint || ''} ${err?.detail || ''} ${err?.message || ''}`;
}

function isGoogleSubUniqueViolation(err) {
  return isPgUniqueViolation(err) && /google_sub/i.test(constraintHint(err));
}

function isUsersEmailUniqueViolation(err) {
  return isPgUniqueViolation(err) && /email/i.test(constraintHint(err));
}

function looksLikeDbErrorMessage(message) {
  return /duplicate key|violates unique constraint|relation "|syntax error|ECONNREFUSED|column .* does not exist|deadlock detected/i.test(
    String(message || ''),
  );
}

function googleAccountExistsBody() {
  return {
    success: false,
    message: ACCOUNT_EXISTS_AZ,
    code: 'ACCOUNT_ALREADY_EXISTS',
  };
}

/**
 * Never expose raw Postgres / driver messages to clients.
 */
function publicGoogleAuthError(err, fallback = GENERIC_GOOGLE_AUTH_AZ) {
  if (!err) return { status: 500, body: { success: false, message: fallback } };

  if (isGoogleSubUniqueViolation(err) || isUsersEmailUniqueViolation(err)) {
    return {
      status: 409,
      body: googleAccountExistsBody(),
    };
  }

  const status = Number(err.statusCode) || 500;
  const msg = String(err.message || '').trim();
  if (status < 500 && msg && !looksLikeDbErrorMessage(msg)) {
    return {
      status,
      body: {
        success: false,
        message: msg,
        ...(err.code ? { code: err.code } : {}),
      },
    };
  }

  return {
    status: status >= 500 ? 500 : status,
    body: { success: false, message: fallback },
  };
}

async function findUserByGoogleSub(db, googleSub) {
  const sub = String(googleSub || '').trim();
  if (!sub) return null;
  const { rows } = await db.query(
    `SELECT ${GOOGLE_USER_COLUMNS}
     FROM users
     WHERE google_sub = $1
       AND TRIM(COALESCE(google_sub::text, '')) <> ''
     ORDER BY
       CASE WHEN COALESCE(is_active, TRUE) = TRUE THEN 0 ELSE 1 END,
       created_at DESC NULLS LAST
     LIMIT 1`,
    [sub],
  );
  return rows[0] || null;
}

async function findUserByEmail(db, email) {
  const e = String(email || '').trim().toLowerCase();
  if (!e) return null;
  const { rows } = await db.query(
    `SELECT ${GOOGLE_USER_COLUMNS}
     FROM users
     WHERE email IS NOT NULL
       AND LOWER(TRIM(email)) = $1
     ORDER BY
       CASE WHEN COALESCE(is_active, TRUE) = TRUE THEN 0 ELSE 1 END,
       CASE WHEN role = 'student' THEN 0 ELSE 1 END,
       created_at DESC NULLS LAST
     LIMIT 1`,
    [e],
  );
  return rows[0] || null;
}

/**
 * Detach google_sub from inactive duplicates so the keep user can claim it.
 * Active conflicts still throw a friendly 409.
 */
async function claimGoogleSubForUser(db, googleSub, keepUserId) {
  const sub = String(googleSub || '').trim();
  if (!sub || !keepUserId) return;

  await db.query(
    `UPDATE users
     SET google_sub = NULL
     WHERE google_sub = $1
       AND id <> $2
       AND COALESCE(is_active, TRUE) = FALSE`,
    [sub, keepUserId],
  );

  const { rows } = await db.query(
    `SELECT id FROM users
     WHERE google_sub = $1
       AND TRIM(COALESCE(google_sub::text, '')) <> ''
       AND id <> $2
     LIMIT 1`,
    [sub, keepUserId],
  );
  if (rows[0]?.id) {
    const err = new Error('Bu Google hesabı artıq başqa istifadəçiyə bağlıdır');
    err.statusCode = 409;
    err.code = 'GOOGLE_SUB_IN_USE';
    throw err;
  }
}

module.exports = {
  GOOGLE_USER_COLUMNS,
  ACCOUNT_EXISTS_AZ,
  GENERIC_GOOGLE_AUTH_AZ,
  isPgUniqueViolation,
  isGoogleSubUniqueViolation,
  isUsersEmailUniqueViolation,
  looksLikeDbErrorMessage,
  googleAccountExistsBody,
  publicGoogleAuthError,
  findUserByGoogleSub,
  findUserByEmail,
  claimGoogleSubForUser,
};
