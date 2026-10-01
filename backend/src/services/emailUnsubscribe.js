/**
 * Signed one-click unsubscribe links for preference-controlled notification emails.
 * Token = base64url(JSON{u,c,v}).base64url(HMAC-SHA256). Scope is one user + one category;
 * mandatory (security/account) categories can never be unsubscribed this way.
 */
const crypto = require('crypto');
const db = require('../utils/db');
const policy = require('../config/notificationPolicy');
const { appLink } = require('./email/emailConfig');

const VERSION = 1;

function secret(env = process.env) {
  const s = String(env.JWT_SECRET || '').trim();
  return s ? `email-unsubscribe:${s}` : '';
}

const b64 = (buf) => Buffer.from(buf).toString('base64url');

function sign(payload, key) {
  return b64(crypto.createHmac('sha256', key).update(payload).digest());
}

function canUnsubscribe(category) {
  return policy.CATEGORIES.includes(category) && !policy.LOCKED_CATEGORIES.has(category);
}

/** @returns {string|null} token, or null when the category is mandatory or no secret is configured */
function createUnsubscribeToken(userId, category, env = process.env) {
  const key = secret(env);
  if (!key || !userId || !canUnsubscribe(category)) return null;
  const payload = b64(JSON.stringify({ u: String(userId), c: category, v: VERSION }));
  return `${payload}.${sign(payload, key)}`;
}

/** @returns {{ userId: string, category: string } | null} */
function verifyUnsubscribeToken(token, env = process.env) {
  const key = secret(env);
  const raw = String(token || '').trim();
  if (!key || raw.length > 512) return null;
  const [payload, sig] = raw.split('.');
  if (!payload || !sig) return null;
  const expected = sign(payload, key);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (data.v !== VERSION || !data.u || !canUnsubscribe(data.c)) return null;
    return { userId: String(data.u), category: data.c };
  } catch {
    return null;
  }
}

function unsubscribeUrl(userId, category, env = process.env) {
  const token = createUnsubscribeToken(userId, category, env);
  return token ? appLink(`/unsubscribe?token=${encodeURIComponent(token)}`, env) : null;
}

/** Short digest binding a parent-address token to the exact address it was sent to. */
function parentEmailDigest(email) {
  return crypto.createHash('sha256').update(String(email || '').trim().toLowerCase()).digest('base64url').slice(0, 16);
}

/**
 * Token for the optional parent contact address on a student profile (no user account behind it).
 * Scope = one student profile + the address digest; a changed address invalidates old links.
 */
function createParentEmailUnsubscribeToken(studentId, parentEmail, env = process.env) {
  const key = secret(env);
  if (!key || !studentId || !String(parentEmail || '').trim()) return null;
  const payload = b64(JSON.stringify({ k: 'pe', s: String(studentId), h: parentEmailDigest(parentEmail), v: VERSION }));
  return `${payload}.${sign(payload, key)}`;
}

/** @returns {{ studentId: string, digest: string } | null} */
function verifyParentEmailUnsubscribeToken(token, env = process.env) {
  const key = secret(env);
  const raw = String(token || '').trim();
  if (!key || raw.length > 512) return null;
  const [payload, sig] = raw.split('.');
  if (!payload || !sig) return null;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(payload, key));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (data.v !== VERSION || data.k !== 'pe' || !data.s || !data.h) return null;
    return { studentId: String(data.s), digest: String(data.h) };
  } catch {
    return null;
  }
}

function parentEmailUnsubscribeUrl(studentId, parentEmail, env = process.env) {
  const token = createParentEmailUnsubscribeToken(studentId, parentEmail, env);
  return token ? appLink(`/unsubscribe?token=${encodeURIComponent(token)}`, env) : null;
}

async function applyParentEmailUnsubscribe(v) {
  const { rows } = await db.query(
    `SELECT parent_email FROM student_profiles WHERE user_id = $1::uuid AND parent_email IS NOT NULL LIMIT 1`,
    [v.studentId],
  );
  if (!rows[0] || parentEmailDigest(rows[0].parent_email) !== v.digest) return { ok: false, code: 'INVALID_TOKEN' };
  await db.query(
    `UPDATE student_profiles
     SET parent_email_opt_out_at = COALESCE(parent_email_opt_out_at, NOW())
     WHERE user_id = $1::uuid AND parent_email IS NOT NULL`,
    [v.studentId],
  );
  return { ok: true, category: 'parent' };
}

/** Turns off the email channel for one category (or one parent contact address). Idempotent. */
async function applyUnsubscribe(token) {
  const pe = verifyParentEmailUnsubscribeToken(token);
  if (pe) return applyParentEmailUnsubscribe(pe);
  const v = verifyUnsubscribeToken(token);
  if (!v) return { ok: false, code: 'INVALID_TOKEN' };
  const { rows } = await db.query(`SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`, [v.userId]);
  if (!rows[0]) return { ok: false, code: 'INVALID_TOKEN' };
  await db.query(
    `INSERT INTO notification_preferences (user_id, category, event_type, channel, enabled, frequency)
     VALUES ($1, $2, NULL, 'email', FALSE, 'off')
     ON CONFLICT (user_id, category, (COALESCE(event_type, '')), channel)
     DO UPDATE SET enabled = FALSE, frequency = 'off', updated_at = NOW()`,
    [v.userId, v.category],
  );
  return { ok: true, category: v.category };
}

module.exports = {
  createUnsubscribeToken,
  verifyUnsubscribeToken,
  unsubscribeUrl,
  applyUnsubscribe,
  canUnsubscribe,
  parentEmailDigest,
  createParentEmailUnsubscribeToken,
  verifyParentEmailUnsubscribeToken,
  parentEmailUnsubscribeUrl,
};
