/**
 * Password reset tokens: only SHA-256 hashes are stored (migration 223). Single-use is enforced
 * atomically (`used_at IS NULL` in the consuming UPDATE), so two concurrent resets with the same
 * link cannot both succeed.
 */
const db = require('../utils/db');
const { generateSecretToken, hashSecretToken } = require('../lib/secretTokens');

const PASSWORD_RESET_TTL_MINUTES = Number(process.env.PASSWORD_RESET_TTL_MINUTES || 30);

/** @returns {Promise<{ token: string, expiresAt: Date }>} raw token: for the email only, never stored or logged */
async function issuePasswordResetToken(userId, opts = {}) {
  const q = opts.client || db;
  const token = generateSecretToken();
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000);
  await q.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, hashSecretToken(token), expiresAt],
  );
  return { token, expiresAt };
}

/** @returns {Promise<{ id: string, user_id: string, expires_at: Date, used_at: Date|null }|null>} */
async function findPasswordResetToken(rawToken, opts = {}) {
  const q = opts.client || db;
  const hash = hashSecretToken(rawToken);
  if (!hash) return null;
  const { rows } = await q.query(
    `SELECT id, user_id, expires_at, used_at
     FROM password_reset_tokens
     WHERE token_hash = $1
     LIMIT 1`,
    [hash],
  );
  if (rows[0]) return rows[0];
  // TODO(223-plaintext-window): remove this fallback (and run scripts/sql/223_clear_plaintext_auth_tokens.sql)
  // once the hashing code has been live longer than PASSWORD_RESET_TTL_MINUTES.
  const legacy = await q.query(
    `SELECT id, user_id, expires_at, used_at
     FROM password_reset_tokens
     WHERE token = $1 AND token_hash IS NULL
     LIMIT 1`,
    [String(rawToken).trim()],
  );
  return legacy.rows[0] || null;
}

/**
 * Marks the token used and drops any plaintext. Must run in the same transaction as the
 * password change. @returns {Promise<boolean>} false when another request already used it.
 */
async function consumePasswordResetToken(client, tokenId) {
  const { rows } = await client.query(
    `UPDATE password_reset_tokens
     SET used_at = NOW(), token = NULL
     WHERE id = $1 AND used_at IS NULL AND expires_at > NOW()
     RETURNING id`,
    [tokenId],
  );
  return rows.length > 0;
}

module.exports = {
  PASSWORD_RESET_TTL_MINUTES,
  issuePasswordResetToken,
  findPasswordResetToken,
  consumePasswordResetToken,
};
