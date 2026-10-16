/**
 * Expiring, use-limited group invite tokens (group_invites) on top of the existing /join/:code flow.
 * The old per-group join_code keeps working; a token is just another code the join page understands.
 *
 * Guarantees (enforced in the database transaction, not only in the UI):
 *   - a token is usable only while status='active', expires_at is in the future and used_count < max_uses;
 *   - the invite row is locked (FOR UPDATE) during a join, so parallel joins can never exceed max_uses;
 *   - one user can redeem a token once (UNIQUE(invite_id, user_id));
 *   - a failed join rolls back, so it never consumes a use;
 *   - every redemption is logged with user, group, enrollment, request, IP and user agent.
 */
const crypto = require('crypto');
const db = require('../utils/db');

const TOKEN_PREFIX = 'INV-';
const TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
const TOKEN_LENGTH = 12;
const DURATION_PRESETS = Object.freeze({ '24h': 24 * 3600 * 1000, '7d': 7 * 86400 * 1000, '30d': 30 * 86400 * 1000 });
const MAX_CUSTOM_DAYS = 365;
const DEFAULT_MAX_USES = 30;
const MAX_USES_CAP = 10000;
const ALLOWED_ROLES = Object.freeze(['student']);
const INACTIVE_MESSAGE = 'Bu dəvət linki artıq aktiv deyil.';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class InviteError extends Error {
  constructor(message, statusCode = 400, code = 'INVITE_INVALID', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    if (details) this.details = details;
  }
}

/* ------------------------------------------------------------------ pure helpers */

function generateToken(randomBytes = crypto.randomBytes) {
  const bytes = randomBytes(TOKEN_LENGTH);
  let out = '';
  for (let i = 0; i < TOKEN_LENGTH; i += 1) out += TOKEN_ALPHABET[bytes[i] % TOKEN_ALPHABET.length];
  return `${TOKEN_PREFIX}${out}`;
}

function normalizeToken(raw) {
  return String(raw || '').trim().toUpperCase().replace(/\s+/g, '');
}

function looksLikeInviteToken(raw) {
  return /^INV-[A-Z0-9]{8,32}$/.test(normalizeToken(raw));
}

/**
 * Validates the create form. Pure (no DB).
 * @param {{ duration?: '24h'|'7d'|'30d'|'custom', expires_at?: string, max_uses?: number, allowed_role?: string, label?: string }} body
 */
function validateInviteInput(body = {}, { now = Date.now() } = {}) {
  const errors = {};
  const out = {};
  const duration = String(body.duration || body.expires_in || '7d').trim().toLowerCase();
  if (DURATION_PRESETS[duration]) {
    out.expires_at = new Date(now + DURATION_PRESETS[duration]);
    out.duration = duration;
  } else if (duration === 'custom') {
    const d = body.expires_at ? new Date(body.expires_at) : null;
    if (!d || Number.isNaN(d.getTime())) errors.expires_at = 'Bitmə tarixini seçin.';
    else if (d.getTime() <= now + 5 * 60 * 1000) errors.expires_at = 'Bitmə tarixi gələcəkdə olmalıdır.';
    else if (d.getTime() > now + MAX_CUSTOM_DAYS * 86400 * 1000) errors.expires_at = `Ən çoxu ${MAX_CUSTOM_DAYS} gün müddətinə link yaratmaq olar.`;
    else {
      out.expires_at = d;
      out.duration = 'custom';
    }
  } else {
    errors.duration = 'Müddəti seçin: 24 saat, 7 gün, 30 gün və ya xüsusi tarix.';
  }

  const rawMax = body.max_uses == null || body.max_uses === '' ? DEFAULT_MAX_USES : Number(body.max_uses);
  if (!Number.isInteger(rawMax) || rawMax < 1 || rawMax > MAX_USES_CAP) {
    errors.max_uses = `İstifadə limiti 1 ilə ${MAX_USES_CAP} arasında tam ədəd olmalıdır.`;
  } else {
    out.max_uses = rawMax;
  }

  const role = String(body.allowed_role || 'student').trim().toLowerCase();
  if (!ALLOWED_ROLES.includes(role)) errors.allowed_role = 'Bu link yalnız tələbələr üçün yaradıla bilər.';
  else out.allowed_role = role;

  const label = String(body.label ?? '').replace(/\u0000/g, '').trim().slice(0, 120);
  out.label = label || null;

  const keys = Object.keys(errors);
  if (keys.length) throw new InviteError(errors[keys[0]], 400, 'VALIDATION', errors);
  return out;
}

/** 'active' | 'revoked' | 'expired' | 'exhausted' (computed; only active/revoked are stored). */
function effectiveStatus(invite, now = Date.now()) {
  if (!invite) return 'missing';
  if (invite.status === 'revoked') return 'revoked';
  if (new Date(invite.expires_at).getTime() <= now) return 'expired';
  if (Number(invite.used_count) >= Number(invite.max_uses)) return 'exhausted';
  return 'active';
}

function inactiveError(status) {
  return new InviteError(INACTIVE_MESSAGE, 410, 'INVITE_INACTIVE', { reason: status });
}

function mapInvite(row, { now = Date.now(), appUrl = null } = {}) {
  const status = effectiveStatus(row, now);
  const base = appUrl || require('./joinInvitationService').getFrontendBaseUrl();
  return {
    id: row.id,
    token: row.token,
    link: `${base}/join/${encodeURIComponent(row.token)}`,
    group_id: row.group_id,
    group_name: row.group_name || null,
    label: row.label || null,
    created_by: row.created_by,
    created_at: row.created_at,
    expires_at: row.expires_at,
    max_uses: Number(row.max_uses),
    used_count: Number(row.used_count),
    remaining_uses: Math.max(0, Number(row.max_uses) - Number(row.used_count)),
    allowed_role: row.allowed_role,
    status,
    revoked_at: row.revoked_at || null,
  };
}

/* ------------------------------------------------------------------ teacher management */

async function assertGroupOwned(instructorId, groupId, client = db) {
  if (!UUID_RE.test(String(groupId || ''))) throw new InviteError('Qrup tapılmadı.', 404, 'GROUP_NOT_FOUND');
  const { rows } = await client.query(
    `SELECT id, name, COALESCE(is_system, FALSE) AS is_system
     FROM instructor_groups WHERE id = $1 AND instructor_id = $2 LIMIT 1`,
    [groupId, instructorId],
  );
  if (!rows[0]) throw new InviteError('Qrup tapılmadı.', 404, 'GROUP_NOT_FOUND');
  if (rows[0].is_system) throw new InviteError('Sistem qrupu üçün dəvət linki yaradıla bilməz.', 400, 'SYSTEM_GROUP');
  return rows[0];
}

async function createInvite(instructorId, groupId, body, { now = Date.now() } = {}) {
  const v = validateInviteInput(body, { now });
  const group = await assertGroupOwned(instructorId, groupId);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = generateToken();
    try {
      // eslint-disable-next-line no-await-in-loop
      const { rows } = await db.query(
        `INSERT INTO group_invites (token, created_by, group_id, label, expires_at, max_uses, allowed_role)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [token, instructorId, group.id, v.label, v.expires_at, v.max_uses, v.allowed_role],
      );
      return mapInvite({ ...rows[0], group_name: group.name }, { now });
    } catch (err) {
      if (err?.code !== '23505') throw err; // token collision → retry
    }
  }
  throw new InviteError('Dəvət linki yaradıla bilmədi. Yenidən cəhd edin.', 500, 'TOKEN_COLLISION');
}

async function listInvites(instructorId, { groupId = null, now = Date.now() } = {}) {
  const params = [instructorId];
  let filter = '';
  if (groupId) {
    if (!UUID_RE.test(String(groupId))) throw new InviteError('Qrup tapılmadı.', 404, 'GROUP_NOT_FOUND');
    params.push(groupId);
    filter = ` AND gi.group_id = $${params.length}`;
  }
  const { rows } = await db.query(
    `SELECT gi.*, ig.name AS group_name
     FROM group_invites gi
     JOIN instructor_groups ig ON ig.id = gi.group_id AND ig.instructor_id = $1
     WHERE gi.created_by = $1${filter}
     ORDER BY gi.created_at DESC
     LIMIT 200`,
    params,
  );
  return rows.map((r) => mapInvite(r, { now }));
}

async function loadOwnedInvite(instructorId, inviteId, client = db, lock = '') {
  if (!UUID_RE.test(String(inviteId || ''))) throw new InviteError('Dəvət linki tapılmadı.', 404, 'NOT_FOUND');
  const { rows } = await client.query(
    `SELECT gi.*, ig.name AS group_name
     FROM group_invites gi
     JOIN instructor_groups ig ON ig.id = gi.group_id
     WHERE gi.id = $1 AND gi.created_by = $2 AND ig.instructor_id = $2
     LIMIT 1 ${lock}`,
    [inviteId, instructorId],
  );
  if (!rows[0]) throw new InviteError('Dəvət linki tapılmadı.', 404, 'NOT_FOUND');
  return rows[0];
}

async function revokeInvite(instructorId, inviteId, { now = Date.now() } = {}) {
  const row = await loadOwnedInvite(instructorId, inviteId);
  if (row.status === 'revoked') return mapInvite(row, { now });
  const { rows } = await db.query(
    `UPDATE group_invites SET status = 'revoked', revoked_at = NOW(), revoked_by = $2
     WHERE id = $1 AND created_by = $2
     RETURNING *`,
    [row.id, instructorId],
  );
  return mapInvite({ ...rows[0], group_name: row.group_name }, { now });
}

async function listRedemptions(instructorId, inviteId) {
  const invite = await loadOwnedInvite(instructorId, inviteId);
  const { rows } = await db.query(
    `SELECT r.id, r.user_id, r.redeemed_at, r.enrollment_id, r.join_request_id, r.ip,
            u.full_name, u.email,
            e.status AS enrollment_status
     FROM group_invite_redemptions r
     JOIN users u ON u.id = r.user_id
     LEFT JOIN enrollments e ON e.id = r.enrollment_id
     WHERE r.invite_id = $1
     ORDER BY r.redeemed_at DESC`,
    [invite.id],
  );
  return {
    invite: mapInvite(invite),
    redemptions: rows.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      full_name: r.full_name,
      email: r.email || null,
      redeemed_at: r.redeemed_at,
      enrollment_id: r.enrollment_id || null,
      enrollment_status: r.enrollment_status || null,
      join_request_id: r.join_request_id || null,
    })),
  };
}

/* ------------------------------------------------------------------ join flow */

/** Read-only lookup for the public join page (no lock). Returns null when the code is not a token. */
async function findInviteByToken(token, client = db) {
  const t = normalizeToken(token);
  if (!looksLikeInviteToken(t)) return null;
  const { rows } = await client.query(`SELECT * FROM group_invites WHERE token = $1 LIMIT 1`, [t]);
  return rows[0] || null;
}

/** Throws INVITE_INACTIVE (410) unless the token can be used right now. */
function assertUsable(invite, { now = Date.now(), role = 'student' } = {}) {
  const status = effectiveStatus(invite, now);
  if (status !== 'active') throw inactiveError(status);
  if (role && invite.allowed_role !== role) {
    throw new InviteError('Bu dəvət linki sizin hesab növünüz üçün deyil.', 403, 'INVITE_ROLE_MISMATCH');
  }
}

/**
 * Inside the caller's join transaction: lock the invite row and verify it is usable.
 * Must be called *before* any other write of the join, so concurrent joins serialize here.
 * @returns {Promise<{ invite: object, alreadyRedeemed: boolean }>}
 */
async function lockInviteForJoin(client, token, userId, { now = Date.now(), role = 'student' } = {}) {
  const t = normalizeToken(token);
  const { rows } = await client.query(`SELECT * FROM group_invites WHERE token = $1 FOR UPDATE`, [t]);
  const invite = rows[0];
  if (!invite) throw new InviteError('Dəvət kodu tapılmadı', 404, 'INVALID_CODE');
  const { rows: prior } = await client.query(
    `SELECT id FROM group_invite_redemptions WHERE invite_id = $1 AND user_id = $2 LIMIT 1`,
    [invite.id, userId],
  );
  if (prior[0]) return { invite, alreadyRedeemed: true };
  assertUsable(invite, { now, role });
  return { invite, alreadyRedeemed: false };
}

/**
 * Inside the same transaction, after the join rows were written: consume one use and log who joined.
 * The UPDATE re-checks the limit, and the table CHECK (used_count <= max_uses) is the last safety net.
 */
async function recordRedemption(client, invite, { userId, enrollmentId = null, joinRequestId = null, ip = null, userAgent = null }) {
  const { rows } = await client.query(
    `UPDATE group_invites SET used_count = used_count + 1
     WHERE id = $1 AND status = 'active' AND used_count < max_uses AND expires_at > NOW()
     RETURNING used_count, max_uses`,
    [invite.id],
  );
  if (!rows[0]) throw inactiveError(effectiveStatus(invite));
  await client.query(
    `INSERT INTO group_invite_redemptions (invite_id, user_id, group_id, enrollment_id, join_request_id, ip, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [invite.id, userId, invite.group_id, enrollmentId, joinRequestId, ip ? String(ip).slice(0, 64) : null, userAgent ? String(userAgent).slice(0, 400) : null],
  );
  return { used_count: rows[0].used_count, max_uses: rows[0].max_uses };
}

module.exports = {
  TOKEN_PREFIX,
  DURATION_PRESETS,
  DEFAULT_MAX_USES,
  INACTIVE_MESSAGE,
  InviteError,
  generateToken,
  normalizeToken,
  looksLikeInviteToken,
  validateInviteInput,
  effectiveStatus,
  mapInvite,
  createInvite,
  listInvites,
  revokeInvite,
  listRedemptions,
  findInviteByToken,
  assertUsable,
  lockInviteForJoin,
  recordRedemption,
};
