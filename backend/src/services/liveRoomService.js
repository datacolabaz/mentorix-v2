const crypto = require('crypto');
const db = require('../utils/db');
const { resolveGroupStudentIds } = require('./assignmentHomeworkService');
const { sendSms } = require('./smsService');
const getCurrentPlan = require('./billingGetCurrentPlan');
const {
  liveLimitsForPlan,
  LIVE_PARTICIPANT_LIMIT_MESSAGE,
} = require('../constants/livePlanLimits');

const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateRoomCode() {
  let suffix = '';
  for (let i = 0; i < 6; i += 1) {
    suffix += ROOM_CODE_CHARS[crypto.randomInt(0, ROOM_CODE_CHARS.length)];
  }
  return `MX-${suffix}`;
}

async function uniqueRoomCode(client = db) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateRoomCode();
    // eslint-disable-next-line no-await-in-loop
    const { rows } = await client.query(`SELECT 1 FROM live_rooms WHERE room_code = $1 LIMIT 1`, [code]);
    if (!rows[0]) return code;
  }
  throw new Error('Otaq kodu yaradılmadı');
}

function jitsiRoomName(roomCode) {
  return `mentorix${String(roomCode || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`;
}

async function assertGroupOwnedByInstructor(instructorId, groupId) {
  const { rows } = await db.query(
    `SELECT id, name FROM instructor_groups WHERE id = $1::uuid AND instructor_id = $2::uuid LIMIT 1`,
    [groupId, instructorId],
  );
  return rows[0] || null;
}

async function userCanAccessLiveRoom(user, room) {
  if (!user || !room) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'instructor' && String(room.instructor_id) === String(user.id)) return true;
  if (user.role !== 'student') return false;
  if (!room.group_id) {
    const { rows } = await db.query(
      `SELECT 1 FROM enrollments e
       WHERE e.student_id = $1 AND e.instructor_id = $2
         AND e.deleted_at IS NULL
         AND COALESCE(LOWER(TRIM(e.status)), 'active') IN ('active', 'pending_setup', 'pending_approval')
       LIMIT 1`,
      [user.id, room.instructor_id],
    );
    return Boolean(rows[0]);
  }
  const studentIds = await resolveGroupStudentIds(room.instructor_id, room.group_id);
  return studentIds.includes(user.id);
}

async function getInstructorLiveParticipantLimit(instructorId) {
  const plan = await getCurrentPlan(db, instructorId);
  const slug = plan?.plan || 'basic';
  const fromPlan = plan?.limits?.live_participants;
  if (fromPlan === null || fromPlan === undefined) {
    return liveLimitsForPlan(slug).maxParticipants;
  }
  const n = Number(fromPlan);
  return Number.isFinite(n) ? n : liveLimitsForPlan(slug).maxParticipants;
}

async function countActiveParticipants(roomId) {
  const { rows } = await db.query(
    `SELECT COUNT(DISTINCT user_id)::int AS c
     FROM live_sessions
     WHERE room_id = $1 AND left_at IS NULL AND role = 'student'`,
    [roomId],
  );
  return Number(rows[0]?.c) || 0;
}

async function getLiveRoomRowByCode(roomCode) {
  const code = String(roomCode || '').trim().toUpperCase();
  const { rows } = await db.query(
    `SELECT lr.*, ig.name AS group_name, u.full_name AS instructor_name
     FROM live_rooms lr
     LEFT JOIN instructor_groups ig ON ig.id = lr.group_id
     JOIN users u ON u.id = lr.instructor_id
     WHERE UPPER(lr.room_code) = $1
     LIMIT 1`,
    [code],
  );
  return rows[0] || null;
}

async function createLiveRoom(instructorId, { groupId, title }) {
  const group = groupId ? await assertGroupOwnedByInstructor(instructorId, groupId) : null;
  if (groupId && !group) {
    const err = new Error('Qrup tapılmadı');
    err.status = 404;
    throw err;
  }

  const roomCode = await uniqueRoomCode();
  const roomTitle = String(title || '').trim() || (group ? `${group.name} — canlı dərs` : 'Mentorix Live');

  const { rows } = await db.query(
    `INSERT INTO live_rooms (room_code, instructor_id, group_id, title, status, started_at)
     VALUES ($1, $2, $3, $4, 'live', NOW())
     RETURNING *`,
    [roomCode, instructorId, groupId || null, roomTitle.slice(0, 255)],
  );
  const room = rows[0];

  void notifyGroupForLiveClass(instructorId, room, group).catch((e) => {
    console.error('[live] sms notify failed:', e?.message || e);
  });

  return room;
}

async function notifyGroupForLiveClass(instructorId, room, group) {
  if (!room?.group_id) return { sent: 0 };
  const { rows: instructorRows } = await db.query(
    `SELECT full_name FROM users WHERE id = $1 LIMIT 1`,
    [instructorId],
  );
  const instructorName = instructorRows[0]?.full_name || 'Müəllim';
  const appBase = String(process.env.APP_URL || process.env.FRONTEND_URL || 'https://mentorix.io').replace(/\/$/, '');
  const link = `${appBase}/live/${room.room_code}`;
  const message = `${instructorName} müəllim canlı dərsi başlatdı!\nQoşulmaq üçün: ${link}`;

  const studentIds = await resolveGroupStudentIds(instructorId, room.group_id);
  if (!studentIds.length) return { sent: 0 };

  const { rows: students } = await db.query(
    `SELECT id, phone FROM users WHERE id = ANY($1::uuid[]) AND phone IS NOT NULL AND TRIM(phone) <> ''`,
    [studentIds],
  );

  let sent = 0;
  for (const student of students) {
    // eslint-disable-next-line no-await-in-loop
    const result = await sendSms({
      instructorId,
      phone: student.phone,
      message,
      logType: 'live_class',
      studentId: student.id,
    });
    if (result?.success) sent += 1;
  }
  return { sent };
}

async function getLiveRoomForUser(roomCode, user) {
  const room = await getLiveRoomRowByCode(roomCode);
  if (!room) {
    const err = new Error('Canlı dərs tapılmadı');
    err.status = 404;
    throw err;
  }
  if (room.status === 'ended') {
    const err = new Error('Bu canlı dərs bitib');
    err.status = 410;
    throw err;
  }
  const ok = await userCanAccessLiveRoom(user, room);
  if (!ok) {
    const err = new Error('Bu otağa giriş icazəniz yoxdur');
    err.status = 403;
    throw err;
  }
  return room;
}

async function joinLiveSession(roomId, userId, role = 'student') {
  const sessionRole = role === 'instructor' ? 'instructor' : 'student';

  const { rows: existing } = await db.query(
    `SELECT id, left_at FROM live_sessions WHERE room_id = $1 AND user_id = $2 LIMIT 1`,
    [roomId, userId],
  );
  const rejoining = existing[0] && existing[0].left_at == null;

  if (sessionRole === 'student' && !rejoining) {
    const { rows: roomRows } = await db.query(
      `SELECT instructor_id FROM live_rooms WHERE id = $1 LIMIT 1`,
      [roomId],
    );
    const instructorId = roomRows[0]?.instructor_id;
    const limit = instructorId ? await getInstructorLiveParticipantLimit(instructorId) : null;
    if (limit != null) {
      const active = await countActiveParticipants(roomId);
      if (active >= limit) {
        const err = new Error(LIVE_PARTICIPANT_LIMIT_MESSAGE);
        err.status = 429;
        err.code = 'LIVE_PARTICIPANT_LIMIT';
        throw err;
      }
    }
  }

  const { rows } = await db.query(
    `INSERT INTO live_sessions (room_id, user_id, role, joined_at, left_at)
     VALUES ($1, $2, $3, NOW(), NULL)
     ON CONFLICT (room_id, user_id) DO UPDATE SET
       role = EXCLUDED.role,
       joined_at = NOW(),
       left_at = NULL
     RETURNING *`,
    [roomId, userId, sessionRole],
  );

  await db.query(
    `UPDATE live_rooms SET
       participant_count = (
         SELECT COUNT(DISTINCT user_id)::int FROM live_sessions WHERE room_id = $1 AND left_at IS NULL
       ),
       status = 'live',
       started_at = COALESCE(started_at, NOW())
     WHERE id = $1`,
    [roomId],
  );
  return rows[0];
}

async function leaveLiveSession(roomId, userId) {
  const { rows } = await db.query(
    `UPDATE live_sessions
     SET left_at = NOW(),
         duration_minutes = GREATEST(1, CEIL(EXTRACT(EPOCH FROM (NOW() - joined_at)) / 60.0))::int
     WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL
     RETURNING *`,
    [roomId, userId],
  );
  await db.query(
    `UPDATE live_rooms SET participant_count = (
       SELECT COUNT(DISTINCT user_id)::int FROM live_sessions WHERE room_id = $1 AND left_at IS NULL
     ) WHERE id = $1`,
    [roomId],
  );
  return rows[0] || null;
}

async function endLiveRoom(instructorId, roomCode) {
  const room = await getLiveRoomRowByCode(roomCode);
  if (!room || String(room.instructor_id) !== String(instructorId)) {
    const err = new Error('Otaq tapılmadı');
    err.status = 404;
    throw err;
  }
  await db.query(
    `UPDATE live_sessions
     SET left_at = COALESCE(left_at, NOW()),
         duration_minutes = COALESCE(duration_minutes, GREATEST(1, CEIL(EXTRACT(EPOCH FROM (COALESCE(left_at, NOW()) - joined_at)) / 60.0))::int)
     WHERE room_id = $1 AND left_at IS NULL`,
    [room.id],
  );
  const { rows } = await db.query(
    `UPDATE live_rooms SET status = 'ended', ended_at = NOW(), participant_count = 0 WHERE id = $1 RETURNING *`,
    [room.id],
  );
  return rows[0];
}

async function listInstructorLiveHistory(instructorId, { limit = 50 } = {}) {
  const cap = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const { rows } = await db.query(
    `SELECT lr.id, lr.room_code, lr.title, lr.status, lr.started_at, lr.ended_at, lr.participant_count, lr.created_at,
            ig.name AS group_name,
            lrec.filename AS recording_filename,
            lrec.duration_sec AS recording_duration_sec,
            (SELECT COUNT(DISTINCT ls.user_id)::int FROM live_sessions ls WHERE ls.room_id = lr.id) AS total_participants,
            (SELECT COALESCE(SUM(ls.duration_minutes), 0)::int FROM live_sessions ls WHERE ls.room_id = lr.id AND ls.duration_minutes IS NOT NULL) AS total_minutes
     FROM live_rooms lr
     LEFT JOIN instructor_groups ig ON ig.id = lr.group_id
     LEFT JOIN live_recordings lrec ON lrec.room_id = lr.id
     WHERE lr.instructor_id = $1
     ORDER BY COALESCE(lr.started_at, lr.created_at) DESC
     LIMIT $2`,
    [instructorId, cap],
  );
  return rows;
}

module.exports = {
  createLiveRoom,
  getLiveRoomForUser,
  getLiveRoomRowByCode,
  joinLiveSession,
  leaveLiveSession,
  endLiveRoom,
  listInstructorLiveHistory,
  jitsiRoomName,
  userCanAccessLiveRoom,
  getInstructorLiveParticipantLimit,
};
