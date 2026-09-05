const crypto = require('crypto');
const { AccessToken } = require('livekit-server-sdk');
const db = require('../utils/db');
const { clientIp: clientIpFromReq } = require('../utils/clientIp');
const { getLiveRoomForUser, getLiveRoomRowByCode } = require('./liveRoomService');
const { getInviteByToken, assertInviteActive, assertParticipantCapacity } = require('./liveGuestService');
const { getLiveKitConfig } = require('../lib/livekitConfig');
const { mapAdmission, shouldReopenGuestParticipant } = require('../lib/liveAdmissionMap');

function httpError(message, status, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function assertRoomOpen(room) {
  if (!room || room.status === 'ended') {
    throw httpError('Bu canlı dərs bitib', 410, 'ROOM_ENDED');
  }
}

async function latestUserAdmission(roomId, userId) {
  const { rows } = await db.query(
    `SELECT * FROM live_admission_requests
     WHERE room_id = $1 AND user_id = $2
     ORDER BY requested_at DESC
     LIMIT 1`,
    [roomId, userId],
  );
  return rows[0] || null;
}

async function latestGuestAdmission(roomId, email) {
  const { rows } = await db.query(
    `SELECT * FROM live_admission_requests
     WHERE room_id = $1 AND requester_kind = 'guest' AND lower(email) = lower($2)
     ORDER BY requested_at DESC
     LIMIT 1`,
    [roomId, email],
  );
  return rows[0] || null;
}

async function requestUserAdmission(room, user) {
  assertRoomOpen(room);
  const existing = await latestUserAdmission(room.id, user.id);
  if (existing && (existing.status === 'pending' || existing.status === 'approved')) {
    return existing;
  }
  try {
    const { rows } = await db.query(
      `INSERT INTO live_admission_requests
         (room_id, requester_kind, user_id, display_name, email, status)
       VALUES ($1, 'user', $2, $3, $4, 'pending')
       RETURNING *`,
      [room.id, user.id, String(user.full_name || 'Tələbə').trim().slice(0, 255), user.email || null],
    );
    return rows[0];
  } catch {
    const again = await latestUserAdmission(room.id, user.id);
    if (again) return again;
    throw httpError('Qoşulma sorğusu yaradılmadı', 500);
  }
}

async function requestGuestAdmission(invite, { fullName, email, phone }) {
  assertRoomOpen({ status: invite.status });
  const existing = await latestGuestAdmission(invite.room_id, email);
  if (existing && (existing.status === 'pending' || existing.status === 'approved')) {
    return existing;
  }
  try {
    const { rows } = await db.query(
      `INSERT INTO live_admission_requests
         (room_id, requester_kind, guest_invite_id, display_name, email, phone_number, status)
       VALUES ($1, 'guest', $2, $3, $4, $5, 'pending')
       RETURNING *`,
      [invite.room_id, invite.id, fullName.slice(0, 255), email.slice(0, 254), phone],
    );
    return rows[0];
  } catch {
    const again = await latestGuestAdmission(invite.room_id, email);
    if (again) return again;
    throw httpError('Qoşulma sorğusu yaradılmadı', 500);
  }
}

async function assertInstructorOwnsRoom(instructorId, roomCode) {
  const room = await getLiveRoomRowByCode(roomCode);
  if (!room || String(room.instructor_id) !== String(instructorId)) {
    throw httpError('Otaq tapılmadı', 404);
  }
  assertRoomOpen(room);
  return room;
}

async function listPendingAdmissions(instructorId, roomCode) {
  const room = await assertInstructorOwnsRoom(instructorId, roomCode);
  const { rows } = await db.query(
    `SELECT * FROM live_admission_requests
     WHERE room_id = $1 AND status = 'pending'
     ORDER BY requested_at ASC`,
    [room.id],
  );
  return rows.map(mapAdmission);
}

async function getAdmissionForRoom(roomId, admissionId) {
  const { rows } = await db.query(
    `SELECT * FROM live_admission_requests WHERE id = $1 AND room_id = $2 LIMIT 1`,
    [admissionId, roomId],
  );
  return rows[0] || null;
}

async function createGuestParticipant(admission, req) {
  const guestId = crypto.randomUUID();
  const joinIp = req ? clientIpFromReq(req) : null;
  const { rows } = await db.query(
    `INSERT INTO live_guest_participants
       (id, invite_id, room_id, full_name, email, phone_number, livekit_identity, join_ip, joined_at, left_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NULL)
     RETURNING *`,
    [
      guestId,
      admission.guest_invite_id,
      admission.room_id,
      admission.display_name,
      admission.email,
      admission.phone_number,
      `guest-${guestId}`,
      joinIp,
    ],
  );
  return rows[0];
}

async function issueGuestToken(roomCode, participant) {
  const { apiKey, apiSecret, wsUrl } = getLiveKitConfig();
  const identity = participant.livekit_identity || `guest-${participant.id}`;
  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    name: String(participant.full_name || 'Qonaq').trim(),
    metadata: JSON.stringify({ guest: true, guestParticipantId: participant.id }),
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
  return { token: await at.toJwt(), wsUrl, identity };
}

async function refreshGuestRoomPresence(roomId) {
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
    [roomId],
  );
}

async function ensureApprovedGuestParticipant(admission, req) {
  if (admission.guest_participant_id) {
    const { rows } = await db.query(`SELECT * FROM live_guest_participants WHERE id = $1 LIMIT 1`, [
      admission.guest_participant_id,
    ]);
    if (rows[0]) {
      if (shouldReopenGuestParticipant(rows[0])) {
        const { rows: reopened } = await db.query(
          `UPDATE live_guest_participants
           SET left_at = NULL, joined_at = NOW()
           WHERE id = $1
           RETURNING *`,
          [rows[0].id],
        );
        await refreshGuestRoomPresence(admission.room_id);
        return reopened[0] || rows[0];
      }
      return rows[0];
    }
  }
  const participant = await createGuestParticipant(admission, req);
  await db.query(
    `UPDATE live_admission_requests SET guest_participant_id = $2 WHERE id = $1`,
    [admission.id, participant.id],
  );
  await refreshGuestRoomPresence(admission.room_id);
  return participant;
}

async function resolveAdmission(instructorId, roomCode, admissionId, status) {
  if (status !== 'approved' && status !== 'denied') {
    throw httpError('Status düzgün deyil', 400);
  }
  const room = await assertInstructorOwnsRoom(instructorId, roomCode);
  const row = await getAdmissionForRoom(room.id, admissionId);
  if (!row) throw httpError('Sorğu tapılmadı', 404);
  if (row.status !== 'pending') return row;
  if (status === 'approved' && row.requester_kind === 'guest') {
    await assertParticipantCapacity({ id: room.id, instructor_id: room.instructor_id });
  }

  const { rows } = await db.query(
    `UPDATE live_admission_requests
     SET status = $3, resolved_at = NOW(), resolved_by = $4
     WHERE id = $1 AND room_id = $2 AND status = 'pending'
     RETURNING *`,
    [admissionId, room.id, status, instructorId],
  );
  const updated = rows[0] || row;
  if (status === 'approved' && updated.requester_kind === 'guest') {
    await ensureApprovedGuestParticipant(updated);
    const { rows: again } = await db.query(`SELECT * FROM live_admission_requests WHERE id = $1`, [updated.id]);
    return again[0] || updated;
  }
  return updated;
}

async function getUserAdmissionStatus(roomCode, user) {
  const room = await getLiveRoomForUser(roomCode, user);
  const isInstructor = user.role === 'instructor' && String(room.instructor_id) === String(user.id);
  if (isInstructor) {
    return { status: 'approved', role: 'instructor', admission: null };
  }
  const row = await latestUserAdmission(room.id, user.id);
  return {
    status: row?.status || 'none',
    role: 'student',
    admission: mapAdmission(row),
  };
}

async function getGuestAdmissionStatus(token, admissionId, req) {
  const invite = await getInviteByToken(token);
  assertInviteActive(invite);
  const { rows } = await db.query(
    `SELECT * FROM live_admission_requests
     WHERE id = $1 AND room_id = $2 AND requester_kind = 'guest'
     LIMIT 1`,
    [admissionId, invite.room_id],
  );
  const row = rows[0];
  if (!row) throw httpError('Sorğu tapılmadı', 404);
  if (row.status === 'denied') {
    throw httpError('Müəllim qoşulmanı rədd etdi', 403, 'ADMISSION_DENIED');
  }
  if (row.status !== 'approved') {
    return {
      pending: true,
      status: row.status,
      admission: mapAdmission(row),
      room: { room_code: invite.room_code, title: invite.title, instructor_name: invite.instructor_name },
    };
  }
  const participant = await ensureApprovedGuestParticipant(row, req);
  const lk = await issueGuestToken(invite.room_code, participant);
  return {
    pending: false,
    status: 'approved',
    admission: mapAdmission(row),
    admission_id: row.id,
    participant: { id: participant.id, full_name: participant.full_name, is_guest: true },
    room: { room_code: invite.room_code, title: invite.title, instructor_name: invite.instructor_name },
    token: lk.token,
    wsUrl: lk.wsUrl,
    identity: lk.identity,
  };
}

async function assertUserMayEnter(room, user) {
  const isInstructor = user.role === 'instructor' && String(room.instructor_id) === String(user.id);
  if (isInstructor) return { isInstructor: true, admission: null };
  const row = await latestUserAdmission(room.id, user.id);
  if (!row || row.status === 'pending') {
    throw httpError('Müəllim təsdiqini gözləyin', 403, 'ADMISSION_PENDING');
  }
  if (row.status === 'denied') {
    throw httpError('Müəllim qoşulmanı rədd etdi', 403, 'ADMISSION_DENIED');
  }
  return { isInstructor: false, admission: row };
}

module.exports = {
  requestUserAdmission,
  requestGuestAdmission,
  listPendingAdmissions,
  resolveAdmission,
  getUserAdmissionStatus,
  getGuestAdmissionStatus,
  assertUserMayEnter,
  mapAdmission,
  latestUserAdmission,
  latestGuestAdmission,
  issueGuestToken,
  ensureApprovedGuestParticipant,
};
