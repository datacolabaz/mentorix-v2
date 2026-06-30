const crypto = require('crypto');
const { AccessToken } = require('livekit-server-sdk');
const db = require('../utils/db');
const { clientIp: clientIpFromReq } = require('../utils/clientIp');
const { canonicalStudentPhone } = require('../utils/studentPhone');
const { getLiveRoomRowByCode, getInstructorLiveParticipantLimit } = require('./liveRoomService');
const { LIVE_PARTICIPANT_LIMIT_MESSAGE } = require('../constants/livePlanLimits');

const DEFAULT_INVITE_HOURS = 24;
const TOKEN_BYTES = 24;

function generateInviteToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString('base64url');
}

function isValidEmail(email) {
  const v = String(email || '').trim();
  if (!v || v.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function assertInviteActive(invite) {
  if (!invite) {
    const err = new Error('Dəvət linki tapılmadı');
    err.status = 404;
    throw err;
  }
  if (invite.revoked_at) {
    const err = new Error('Link ləğv edilib');
    err.status = 410;
    err.code = 'INVITE_REVOKED';
    throw err;
  }
  if (invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now()) {
    const err = new Error('Link vaxtı bitib');
    err.status = 410;
    err.code = 'INVITE_EXPIRED';
    throw err;
  }
}

async function getInviteByToken(token) {
  const t = String(token || '').trim();
  if (!t) return null;
  const { rows } = await db.query(
    `SELECT gi.*, lr.room_code, lr.title, lr.status, lr.instructor_id, lr.group_id, lr.ended_at,
            u.full_name AS instructor_name
     FROM live_guest_invites gi
     JOIN live_rooms lr ON lr.id = gi.room_id
     JOIN users u ON u.id = lr.instructor_id
     WHERE gi.token = $1
     LIMIT 1`,
    [t],
  );
  return rows[0] || null;
}

async function assertInstructorOwnsRoom(instructorId, roomCode) {
  const room = await getLiveRoomRowByCode(roomCode);
  if (!room || String(room.instructor_id) !== String(instructorId)) {
    const err = new Error('Otaq tapılmadı');
    err.status = 404;
    throw err;
  }
  if (room.status === 'ended') {
    const err = new Error('Bu canlı dərs bitib');
    err.status = 410;
    throw err;
  }
  return room;
}

async function countActiveGuestParticipants(roomId) {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS c FROM live_guest_participants
     WHERE room_id = $1 AND left_at IS NULL`,
    [roomId],
  );
  return Number(rows[0]?.c) || 0;
}

async function countActiveStudentParticipants(roomId) {
  const { rows } = await db.query(
    `SELECT COUNT(DISTINCT user_id)::int AS c
     FROM live_sessions
     WHERE room_id = $1 AND left_at IS NULL AND role = 'student'`,
    [roomId],
  );
  return Number(rows[0]?.c) || 0;
}

async function countActiveLiveParticipants(roomId, instructorId) {
  const students = await countActiveStudentParticipants(roomId);
  const guests = await countActiveGuestParticipants(roomId);
  return { students, guests, total: students + guests };
}

async function assertParticipantCapacity(room) {
  const limit = room?.instructor_id ? await getInstructorLiveParticipantLimit(room.instructor_id) : null;
  if (limit == null) return;
  const { total } = await countActiveLiveParticipants(room.id, room.instructor_id);
  if (total >= limit) {
    const err = new Error(LIVE_PARTICIPANT_LIMIT_MESSAGE);
    err.status = 429;
    err.code = 'LIVE_PARTICIPANT_LIMIT';
    throw err;
  }
}

async function createGuestInvite(instructorId, roomCode, { expiresHours = DEFAULT_INVITE_HOURS } = {}) {
  const room = await assertInstructorOwnsRoom(instructorId, roomCode);

  await db.query(
    `UPDATE live_guest_invites SET revoked_at = NOW()
     WHERE room_id = $1 AND revoked_at IS NULL`,
    [room.id],
  );

  const token = generateInviteToken();
  const hours = Math.min(Math.max(Number(expiresHours) || DEFAULT_INVITE_HOURS, 1), 72);
  const { rows } = await db.query(
    `INSERT INTO live_guest_invites (room_id, token, expires_at, created_by)
     VALUES ($1, $2, NOW() + ($3::text || ' hours')::interval, $4)
     RETURNING *`,
    [room.id, token, String(hours), instructorId],
  );
  const invite = rows[0];
  return {
    invite,
    room,
    join_path: `/live/join/${token}`,
  };
}

async function revokeGuestInvite(instructorId, roomCode) {
  const room = await assertInstructorOwnsRoom(instructorId, roomCode);
  const { rows } = await db.query(
    `UPDATE live_guest_invites
     SET revoked_at = NOW()
     WHERE room_id = $1 AND revoked_at IS NULL
     RETURNING *`,
    [room.id],
  );
  return rows[0] || null;
}

async function getActiveGuestInviteForRoom(instructorId, roomCode) {
  const room = await assertInstructorOwnsRoom(instructorId, roomCode);
  const { rows } = await db.query(
    `SELECT * FROM live_guest_invites
     WHERE room_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [room.id],
  );
  const invite = rows[0];
  if (!invite) return null;
  return {
    token: invite.token,
    expires_at: invite.expires_at,
    join_path: `/live/join/${invite.token}`,
  };
}

function buildLiveKitConfig() {
  const apiKey = String(process.env.LIVEKIT_API_KEY || '').trim();
  const apiSecret = String(process.env.LIVEKIT_API_SECRET || '').trim();
  const wsUrl = String(
    process.env.LIVEKIT_WS_URL || process.env.LIVEKIT_URL || process.env.NEXT_PUBLIC_LIVEKIT_URL || '',
  )
    .trim()
    .replace(/^https:\/\//i, 'wss://')
    .replace(/^http:\/\//i, 'ws://');
  if (!apiKey || !apiSecret || !wsUrl) {
    const err = new Error(
      'LiveKit konfiqurasiya olunmayıb. Backend service-də LIVEKIT_API_KEY, LIVEKIT_API_SECRET və LIVEKIT_WS_URL əlavə edin.',
    );
    err.status = 503;
    throw err;
  }
  return { apiKey, apiSecret, wsUrl };
}

async function issueGuestLiveKitToken({ roomCode, guestParticipantId, fullName }) {
  const { apiKey, apiSecret, wsUrl } = buildLiveKitConfig();
  const identity = `guest-${guestParticipantId}`;
  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    name: String(fullName || 'Qonaq').trim(),
    metadata: JSON.stringify({ guest: true, guestParticipantId }),
    ttl: '4h',
  });
  at.addGrant({
    roomJoin: true,
    room: String(roomCode).trim().toUpperCase(),
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    roomAdmin: false,
  });
  const token = await at.toJwt();
  return { token, wsUrl, identity };
}

async function joinAsGuest(token, body, req) {
  const invite = await getInviteByToken(token);
  assertInviteActive(invite);

  if (invite.status === 'ended') {
    const err = new Error('Bu canlı dərs bitib');
    err.status = 410;
    throw err;
  }

  const fullName = String(body?.fullName || body?.full_name || '').trim();
  const email = String(body?.email || '').trim().toLowerCase();
  const phoneRaw = body?.phoneNumber ?? body?.phone_number ?? body?.phone;
  const phone = canonicalStudentPhone(phoneRaw);

  if (fullName.length < 3) {
    const err = new Error('Ad Soyad ən azı 3 simvol olmalıdır');
    err.status = 400;
    throw err;
  }
  if (!isValidEmail(email)) {
    const err = new Error('Düzgün email daxil edin');
    err.status = 400;
    throw err;
  }
  if (!phone) {
    const err = new Error('Mobil nömrə düzgün deyil (+994 və 9 rəqəm)');
    err.status = 400;
    throw err;
  }

  await assertParticipantCapacity({ id: invite.room_id, instructor_id: invite.instructor_id });

  const guestId = crypto.randomUUID();
  const joinIp = req ? clientIpFromReq(req) : null;

  const { rows } = await db.query(
    `INSERT INTO live_guest_participants
       (id, invite_id, room_id, full_name, email, phone_number, livekit_identity, join_ip, joined_at, left_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NULL)
     RETURNING *`,
    [
      guestId,
      invite.id,
      invite.room_id,
      fullName.slice(0, 255),
      email.slice(0, 254),
      phone,
      `guest-${guestId}`,
      joinIp,
    ],
  );
  const participant = rows[0];

  await db.query(
    `UPDATE live_rooms SET
       participant_count = (
         SELECT COUNT(DISTINCT user_id)::int FROM live_sessions WHERE room_id = $1 AND left_at IS NULL
       ) + (
         SELECT COUNT(*)::int FROM live_guest_participants WHERE room_id = $1 AND left_at IS NULL
       ),
       status = 'live',
       started_at = COALESCE(started_at, NOW())
     WHERE id = $1`,
    [invite.room_id],
  );

  const lk = await issueGuestLiveKitToken({
    roomCode: invite.room_code,
    guestParticipantId: participant.id,
    fullName,
  });

  return {
    participant: {
      id: participant.id,
      full_name: participant.full_name,
      is_guest: true,
    },
    room: {
      room_code: invite.room_code,
      title: invite.title,
      instructor_name: invite.instructor_name,
    },
    token: lk.token,
    wsUrl: lk.wsUrl,
    identity: lk.identity,
  };
}

async function leaveGuestParticipant(participantId) {
  const { rows } = await db.query(
    `UPDATE live_guest_participants
     SET left_at = NOW(),
         duration_minutes = GREATEST(1, CEIL(EXTRACT(EPOCH FROM (NOW() - joined_at)) / 60.0))::int
     WHERE id = $1 AND left_at IS NULL
     RETURNING *`,
    [participantId],
  );
  const row = rows[0];
  if (row) {
    await db.query(
      `UPDATE live_rooms SET participant_count = (
         SELECT COUNT(DISTINCT user_id)::int FROM live_sessions WHERE room_id = $1 AND left_at IS NULL
       ) + (
         SELECT COUNT(*)::int FROM live_guest_participants WHERE room_id = $1 AND left_at IS NULL
       ) WHERE id = $1`,
      [row.room_id],
    );
  }
  return row;
}

async function listGuestsForRoom(roomId) {
  const { rows } = await db.query(
    `SELECT id, full_name, email, phone_number, joined_at, left_at, duration_minutes
     FROM live_guest_participants
     WHERE room_id = $1
     ORDER BY joined_at ASC`,
    [roomId],
  );
  return rows;
}

async function getPublicInviteInfo(token) {
  const invite = await getInviteByToken(token);
  if (!invite) {
    const err = new Error('Dəvət linki tapılmadı');
    err.status = 404;
    throw err;
  }
  const expired = invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now();
  const revoked = Boolean(invite.revoked_at);
  const ended = invite.status === 'ended';
  return {
    valid: !expired && !revoked && !ended,
    expired,
    revoked,
    ended,
    room: {
      title: invite.title,
      room_code: invite.room_code,
      instructor_name: invite.instructor_name,
    },
    expires_at: invite.expires_at,
  };
}

module.exports = {
  createGuestInvite,
  revokeGuestInvite,
  getActiveGuestInviteForRoom,
  joinAsGuest,
  leaveGuestParticipant,
  listGuestsForRoom,
  getPublicInviteInfo,
  countActiveGuestParticipants,
  countActiveLiveParticipants,
  getInviteByToken,
};
