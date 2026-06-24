const crypto = require('crypto');
const db = require('../utils/db');
const { sendVerificationEmail } = require('./emailVerificationService');

const EMAIL_VERIFICATION_TTL_MINUTES = Number(process.env.EMAIL_VERIFICATION_TTL_MINUTES || 60);

function generateVerificationToken() {
  return crypto.randomBytes(24).toString('hex');
}

function generateVerificationCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * İstifadəçiyə yeni token + 6 rəqəm kodu yazır və email göndərir.
 */
async function issueEmailVerification(userId, email) {
  const token = generateVerificationToken();
  const code = generateVerificationCode();
  const expiry = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MINUTES * 60 * 1000);

  await db.query(
    `UPDATE users
     SET verification_token = $1,
         verification_code = $2,
         verification_expiry = $3,
         is_verified = FALSE
     WHERE id = $4`,
    [token, code, expiry, userId],
  );

  const mail = await sendVerificationEmail({ email, token, code });
  return { token, code, expiry, mail };
}

/** Cavabı gecikdirməmək üçün email göndərməni arxa planda işlədir */
function queueEmailVerification(userId, email) {
  void issueEmailVerification(userId, email)
    .then(({ mail }) => {
      if (!mail?.ok) {
        console.error('[email-verification] send failed', {
          userId,
          email,
          error: mail?.error,
        });
      }
    })
    .catch((err) => {
      console.error('[email-verification] queue error', {
        userId,
        email,
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
         verification_expiry = NULL
     WHERE id = $1`,
    [userId],
  );
}

async function findUserForVerification({ token, email, code }) {
  const t = String(token || '').trim();
  const e = String(email || '').trim().toLowerCase();
  const c = String(code || '').trim();

  if (t) {
    const { rows } = await db.query(
      `SELECT id, email, is_verified, verification_expiry
       FROM users WHERE verification_token = $1 LIMIT 1`,
      [t],
    );
    return rows[0] || null;
  }

  if (e && c) {
    const { rows } = await db.query(
      `SELECT id, email, is_verified, verification_expiry
       FROM users
       WHERE lower(trim(email)) = $1
         AND verification_code = $2
       LIMIT 1`,
      [e, c],
    );
    return rows[0] || null;
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
