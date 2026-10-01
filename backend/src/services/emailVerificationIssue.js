const db = require('../utils/db');
const { sendVerificationEmail } = require('./emailVerificationService');
const { maskEmail } = require('./email/emailTransport');
const {
  generateSecretToken,
  generateVerificationCode,
  hashSecretToken,
  hashVerificationCode,
  hashesEqual,
} = require('../lib/secretTokens');

const EMAIL_VERIFICATION_TTL_MINUTES = Number(process.env.EMAIL_VERIFICATION_TTL_MINUTES || 60);

/** Back-compat export name; the token is 32 random bytes (hex). */
const generateVerificationToken = generateSecretToken;

/**
 * İstifadəçiyə yeni token + 6 rəqəm kodu yaradır və email göndərir.
 * DB-də yalnız hash-lər saxlanılır (migration 223); xam dəyərlər yalnız emaildədir.
 */
async function issueEmailVerification(userId, email) {
  const token = generateSecretToken();
  const code = generateVerificationCode();
  const expiry = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MINUTES * 60 * 1000);

  await db.query(
    `UPDATE users
     SET verification_token_hash = $1,
         verification_code_hash = $2,
         verification_token = NULL,
         verification_code = NULL,
         verification_expiry = $3
     WHERE id = $4`,
    [hashSecretToken(token), hashVerificationCode(userId, code), expiry, userId],
  );

  const mail = await sendVerificationEmail({ email, token, code });
  return { expiry, mail };
}

/** Cavabı gecikdirməmək üçün email göndərməni arxa planda işlədir */
function queueEmailVerification(userId, email) {
  void issueEmailVerification(userId, email)
    .then(({ mail }) => {
      if (!mail?.ok) {
        console.error('[email-verification] send failed', {
          userId,
          email: maskEmail(email),
          error: mail?.error,
        });
      }
    })
    .catch((err) => {
      console.error('[email-verification] queue error', {
        userId,
        email: maskEmail(email),
        message: err?.message,
      });
    });
}

async function clearVerificationFields(userId) {
  await db.query(
    `UPDATE users
     SET is_verified = TRUE,
         verification_token = NULL,
         verification_code = NULL,
         verification_token_hash = NULL,
         verification_code_hash = NULL,
         verification_expiry = NULL
     WHERE id = $1`,
    [userId],
  );
}

const PUBLIC_FIELDS = 'id, email, is_verified, verification_expiry';

async function findUserForVerification({ token, email, code }) {
  const t = String(token || '').trim();
  const e = String(email || '').trim().toLowerCase();
  const c = String(code || '').trim();

  if (t) {
    const { rows } = await db.query(
      `SELECT ${PUBLIC_FIELDS} FROM users WHERE verification_token_hash = $1 LIMIT 1`,
      [hashSecretToken(t)],
    );
    if (rows[0]) return rows[0];
    // TODO(223-plaintext-window): remove (and run scripts/sql/223_clear_plaintext_auth_tokens.sql)
    // once the hashing code has been live longer than EMAIL_VERIFICATION_TTL_MINUTES.
    const legacy = await db.query(
      `SELECT ${PUBLIC_FIELDS} FROM users WHERE verification_token = $1 AND verification_token_hash IS NULL LIMIT 1`,
      [t],
    );
    return legacy.rows[0] || null;
  }

  if (e && c) {
    const { rows } = await db.query(
      `SELECT ${PUBLIC_FIELDS}, verification_code_hash, verification_code
       FROM users
       WHERE lower(trim(email)) = $1
         AND (verification_code_hash IS NOT NULL OR verification_code IS NOT NULL)
       LIMIT 5`,
      [e],
    );
    for (const row of rows) {
      const ok = row.verification_code_hash
        ? hashesEqual(hashVerificationCode(row.id, c), row.verification_code_hash)
        : // TODO(223-plaintext-window): remove the plaintext code branch with the token fallback above.
          hashesEqual(hashSecretToken(c), hashSecretToken(row.verification_code));
      if (ok) return { id: row.id, email: row.email, is_verified: row.is_verified, verification_expiry: row.verification_expiry };
    }
    return null;
  }

  return null;
}

function isVerificationExpired(user) {
  const exp = user?.verification_expiry ? new Date(user.verification_expiry).getTime() : 0;
  return !Number.isFinite(exp) || exp < Date.now();
}

module.exports = {
  issueEmailVerification,
  queueEmailVerification,
  clearVerificationFields,
  findUserForVerification,
  isVerificationExpired,
  generateVerificationToken,
  generateVerificationCode,
};
