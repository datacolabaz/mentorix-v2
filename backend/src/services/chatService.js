const db = require('../utils/db');
const { normalizePlanSlug, planRank } = require('../config/plans');
const { resolveEntitlements } = require('./billingEntitlements');
const { getActivePlansMap } = require('./subscriptionPlansService');
const { higherPaidPlansLabel } = require('./billingAlertHelpers');
const { ACTIVE_ENROLLMENT_WHERE } = require('../sql/activeEnrollments');
const { publishChatMessage } = require('./chatRealtimeHub');
const { touchUserActivity, mapRowsWithPresence } = require('./userPresenceService');

const MAX_BODY_LEN = 4000;
const DEFAULT_LIMIT = 50;

function httpError(code, status, message) {
  const err = new Error(message || code);
  err.code = code;
  err.status = status;
  err.statusCode = status;
  return err;
}

function canUseDirectChat(planSlug) {
  return planRank(normalizePlanSlug(planSlug)) >= planRank('pro');
}

async function directChatDeniedMessage() {
  const plansMap = await getActivePlansMap();
  const label = higherPaidPlansLabel(plansMap, 'basic');
  const tier =
    String(label).replace(/\s+və ya daha yüksək paket$/i, '').trim() ||
    String(plansMap?.pro?.title || plansMap?.pro?.slug || 'STANDART').trim();
  return `Fərdi çat funksiyası yalnız ${tier} və daha yüksək paketlərdə aktivdir. Zəhmət olmasa paketinizi yeniləyin.`;
}

async function assertInstructorDirectChatAllowed(instructorId) {
  const ent = await resolveEntitlements(instructorId);
  if (canUseDirectChat(ent.plan)) return ent;
  throw httpError('DIRECT_CHAT_PLAN_REQUIRED', 403, await directChatDeniedMessage());
}

function serializeRoom(row) {
  if (!row) return null;
  return {
    id: row.id,
    room_kind: row.room_kind,
    title: row.title || null,
    instructor_id: row.instructor_id,
    instructor_group_id: row.instructor_group_id || null,
    assignment_id: row.assignment_id || null,
    student_id: row.student_id || null,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

function serializeMessage(row) {
  return {
    id: row.id,
    room_id: row.room_id,
    sender_id: row.sender_id,
    sender_name: row.sender_name || null,
    sender_role: row.sender_role || null,
    body: row.body,
    attachment_url: row.attachment_url || null,
    attachment_type: row.attachment_type || null,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
  };
}

async function loadGroupForInstructor(groupId, instructorId) {
  const { rows } = await db.query(
    `SELECT id, instructor_id, name, is_system
     FROM instructor_groups
     WHERE id = $1::uuid AND instructor_id = $2::uuid
     LIMIT 1`,
    [groupId, instructorId],
  );
  return rows[0] || null;
}

async function loadAssignmentForInstructor(assignmentId, instructorId) {
  const { rows } = await db.query(
    `SELECT id, instructor_id, title, group_id, participant_group_id
     FROM assignments
     WHERE id = $1::uuid AND instructor_id = $2::uuid
     LIMIT 1`,
    [assignmentId, instructorId],
  );
  return rows[0] || null;
}

async function studentHasGroupAccess(studentId, groupId, instructorId) {
  const { rows: enr } = await db.query(
    `SELECT 1
     FROM enrollments e
     WHERE e.student_id = $1::uuid
       AND e.instructor_id = $2::uuid
       AND e.group_id = $3::uuid
       AND e.deleted_at IS NULL
       AND COALESCE(e.status, 'active') = 'active'
     LIMIT 1`,
    [studentId, instructorId, groupId],
  );
  if (enr[0]) return true;

  const { rows: mem } = await db.query(
    `SELECT 1
     FROM instructor_group_members igm
     JOIN instructor_groups ig ON ig.id = igm.group_id
     WHERE igm.student_id = $1::uuid
       AND igm.group_id = $2::uuid
       AND ig.instructor_id = $3::uuid
     LIMIT 1`,
    [studentId, groupId, instructorId],
  );
  return Boolean(mem[0]);
}

async function studentHasAssignmentAccess(studentId, assignmentId) {
  const { rows } = await db.query(
    `SELECT 1
     FROM student_assignments sa
     WHERE sa.student_id = $1::uuid
       AND sa.assignment_id = $2::uuid
     LIMIT 1`,
    [studentId, assignmentId],
  );
  return Boolean(rows[0]);
}

async function studentLinkedToInstructor(studentId, instructorId) {
  const { rows } = await db.query(
    `SELECT 1
     FROM enrollments e
     WHERE e.student_id = $1::uuid
       AND e.instructor_id = $2::uuid
       AND e.deleted_at IS NULL
       AND ${ACTIVE_ENROLLMENT_WHERE}
     LIMIT 1`,
    [studentId, instructorId],
  );
  return Boolean(rows[0]);
}

async function getRoomById(roomId) {
  const { rows } = await db.query(`SELECT * FROM chat_rooms WHERE id = $1::uuid LIMIT 1`, [roomId]);
  return rows[0] || null;
}

async function assertRoomAccess(userId, role, room) {
  if (!room) throw httpError('CHAT_ROOM_NOT_FOUND', 404, 'Çat tapılmadı');
  const uid = String(userId);
  const instructorId = String(room.instructor_id);

  if (role === 'instructor') {
    if (uid === instructorId) return room;
    throw httpError('CHAT_FORBIDDEN', 403, 'Bu çata giriş icazəniz yoxdur');
  }

  if (role === 'student') {
    if (room.room_kind === 'group') {
      const ok = await studentHasGroupAccess(uid, room.instructor_group_id, instructorId);
      if (ok) return room;
    }
    if (room.room_kind === 'assignment') {
      const ok = await studentHasAssignmentAccess(uid, room.assignment_id);
      if (ok) return room;
    }
    if (room.room_kind === 'direct' && String(room.student_id) === uid) {
      return room;
    }
    throw httpError('CHAT_FORBIDDEN', 403, 'Bu çata giriş icazəniz yoxdur');
  }

  throw httpError('CHAT_FORBIDDEN', 403, 'Bu çata giriş icazəniz yoxdur');
}

async function upsertGroupRoom(instructorId, group) {
  const { rows: existing } = await db.query(
    `SELECT * FROM chat_rooms
     WHERE room_kind = 'group' AND instructor_group_id = $1::uuid
     LIMIT 1`,
    [group.id],
  );
  if (existing[0]) return existing[0];

  const { rows } = await db.query(
    `INSERT INTO chat_rooms (room_kind, instructor_id, instructor_group_id, title)
     VALUES ('group', $1::uuid, $2::uuid, $3)
     RETURNING *`,
    [instructorId, group.id, group.name || 'Qrup çatı'],
  );
  return rows[0];
}

async function upsertAssignmentRoom(instructorId, assignment) {
  const { rows: existing } = await db.query(
    `SELECT * FROM chat_rooms
     WHERE room_kind = 'assignment' AND assignment_id = $1::uuid
     LIMIT 1`,
    [assignment.id],
  );
  if (existing[0]) return existing[0];

  const title = assignment.title ? `${assignment.title} — çat` : 'Tapşırıq çatı';
  const { rows } = await db.query(
    `INSERT INTO chat_rooms (room_kind, instructor_id, assignment_id, title)
     VALUES ('assignment', $1::uuid, $2::uuid, $3)
     RETURNING *`,
    [instructorId, assignment.id, title],
  );
  return rows[0];
}

async function upsertDirectRoom(instructorId, studentId, studentName) {
  await assertInstructorDirectChatAllowed(instructorId);

  const linked = await studentLinkedToInstructor(studentId, instructorId);
  if (!linked) throw httpError('CHAT_STUDENT_NOT_LINKED', 404, 'Tələbə sizin siyahınızda deyil');

  const { rows: existing } = await db.query(
    `SELECT * FROM chat_rooms
     WHERE room_kind = 'direct' AND instructor_id = $1::uuid AND student_id = $2::uuid
     LIMIT 1`,
    [instructorId, studentId],
  );
  if (existing[0]) return existing[0];

  const title = studentName ? `${studentName} — fərdi çat` : 'Fərdi çat';
  const { rows } = await db.query(
    `INSERT INTO chat_rooms (room_kind, instructor_id, student_id, title)
     VALUES ('direct', $1::uuid, $2::uuid, $3)
     RETURNING *`,
    [instructorId, studentId, title],
  );
  return rows[0];
}

async function openRoomForUser({ userId, role, kind, groupId, assignmentId, studentId, studentName }) {
  const normalizedKind = String(kind || '').trim().toLowerCase();

  if (normalizedKind === 'group') {
    if (!groupId) throw httpError('CHAT_GROUP_REQUIRED', 400, 'Qrup seçilməyib');
    let group;
    if (role === 'instructor') {
      group = await loadGroupForInstructor(groupId, userId);
      if (!group) throw httpError('CHAT_GROUP_NOT_FOUND', 404, 'Qrup tapılmadı');
    } else if (role === 'student') {
      const { rows } = await db.query(
        `SELECT ig.id, ig.instructor_id, ig.name, ig.is_system
         FROM instructor_groups ig
         WHERE ig.id = $1::uuid
         LIMIT 1`,
        [groupId],
      );
      group = rows[0];
      if (!group) throw httpError('CHAT_GROUP_NOT_FOUND', 404, 'Qrup tapılmadı');
      const ok = await studentHasGroupAccess(userId, groupId, group.instructor_id);
      if (!ok) throw httpError('CHAT_FORBIDDEN', 403, 'Bu qrup çatına giriş icazəniz yoxdur');
    } else {
      throw httpError('CHAT_FORBIDDEN', 403, 'İcazə yoxdur');
    }
    const room = await upsertGroupRoom(group.instructor_id, group);
    return serializeRoom(room);
  }

  if (normalizedKind === 'assignment') {
    if (!assignmentId) throw httpError('CHAT_ASSIGNMENT_REQUIRED', 400, 'Tapşırıq seçilməyib');
    let assignment;
    if (role === 'instructor') {
      assignment = await loadAssignmentForInstructor(assignmentId, userId);
      if (!assignment) throw httpError('CHAT_ASSIGNMENT_NOT_FOUND', 404, 'Tapşırıq tapılmadı');
    } else if (role === 'student') {
      const { rows } = await db.query(
        `SELECT id, instructor_id, title, group_id, participant_group_id
         FROM assignments
         WHERE id = $1::uuid
         LIMIT 1`,
        [assignmentId],
      );
      assignment = rows[0];
      if (!assignment) throw httpError('CHAT_ASSIGNMENT_NOT_FOUND', 404, 'Tapşırıq tapılmadı');
      const ok = await studentHasAssignmentAccess(userId, assignmentId);
      if (!ok) throw httpError('CHAT_FORBIDDEN', 403, 'Bu tapşırıq çatına giriş icazəniz yoxdur');
    } else {
      throw httpError('CHAT_FORBIDDEN', 403, 'İcazə yoxdur');
    }
    const room = await upsertAssignmentRoom(assignment.instructor_id, assignment);
    return serializeRoom(room);
  }

  if (normalizedKind === 'direct') {
    if (role !== 'instructor') {
      throw httpError('CHAT_FORBIDDEN', 403, 'Fərdi çatı yalnız müəllim başlada bilər');
    }
    if (!studentId) throw httpError('CHAT_STUDENT_REQUIRED', 400, 'Tələbə seçilməyib');
    const room = await upsertDirectRoom(userId, studentId, studentName);
    return serializeRoom(room);
  }

  throw httpError('CHAT_KIND_INVALID', 400, 'Çat növü düzgün deyil');
}

async function listRoomMessages({ roomId, userId, role, before, limitRaw }) {
  const room = await getRoomById(roomId);
  await assertRoomAccess(userId, role, room);

  const limit = Math.min(100, Math.max(1, Number(limitRaw) || DEFAULT_LIMIT));
  const params = [roomId];
  let beforeSql = '';
  if (before) {
    params.push(before);
    beforeSql = `AND m.created_at < $${params.length}::timestamptz`;
  }
  params.push(limit);

  const { rows } = await db.query(
    `SELECT m.id, m.room_id, m.sender_id, m.body, m.attachment_url, m.attachment_type, m.created_at,
            u.full_name AS sender_name, u.role AS sender_role
     FROM chat_messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.room_id = $1::uuid
       ${beforeSql}
     ORDER BY m.created_at DESC
     LIMIT $${params.length}`,
    params,
  );

  return (rows || []).reverse().map(serializeMessage);
}

async function sendRoomMessage({
  roomId,
  userId,
  role,
  bodyRaw,
  attachmentUrl,
  attachmentType,
}) {
  const body = String(bodyRaw || '').trim();
  const attachment_url = attachmentUrl ? String(attachmentUrl).trim() : null;
  const attachment_type = attachmentType ? String(attachmentType).trim() : null;

  if (!body && !attachment_url) {
    throw httpError('CHAT_BODY_REQUIRED', 400, 'Mesaj və ya fayl tələb olunur');
  }
  if (body.length > MAX_BODY_LEN) {
    throw httpError('CHAT_BODY_TOO_LONG', 400, `Mesaj çox uzundur (maks. ${MAX_BODY_LEN} simvol)`);
  }

  const room = await getRoomById(roomId);
  await assertRoomAccess(userId, role, room);

  const { rows } = await db.query(
    `INSERT INTO chat_messages (room_id, sender_id, body, attachment_url, attachment_type)
     VALUES ($1::uuid, $2::uuid, $3, $4, $5)
     RETURNING id, room_id, sender_id, body, attachment_url, attachment_type, created_at`,
    [roomId, userId, body, attachment_url, attachment_type],
  );

  await db.query(`UPDATE chat_rooms SET updated_at = NOW() WHERE id = $1::uuid`, [roomId]);

  const { rows: senderRows } = await db.query(
    `SELECT full_name, role FROM users WHERE id = $1::uuid LIMIT 1`,
    [userId],
  );
  const sender = senderRows[0] || {};

  const serialized = serializeMessage({
    ...rows[0],
    sender_name: sender.full_name,
    sender_role: sender.role,
  });
  publishChatMessage(roomId, serialized);
  return serialized;
}

const GROUP_MEMBER_COUNT_SQL = `
  (
    SELECT COUNT(DISTINCT e.student_id)::int
    FROM enrollments e
    WHERE e.group_id = ig.id
      AND e.deleted_at IS NULL
      AND COALESCE(LOWER(TRIM(e.status)), 'active') = 'active'
  ) + 1
`;

const GROUP_ONLINE_COUNT_SQL = `
  (
    SELECT COUNT(DISTINCT u.id)::int
    FROM (
      SELECT e.student_id AS uid
      FROM enrollments e
      WHERE e.group_id = ig.id
        AND e.deleted_at IS NULL
        AND COALESCE(LOWER(TRIM(e.status)), 'active') = 'active'
      UNION
      SELECT ig.instructor_id AS uid
    ) members
    JOIN users u ON u.id = members.uid
    WHERE u.deleted_at IS NULL
      AND u.last_activity_at >= NOW() - INTERVAL '5 minutes'
  )
`;

async function listGroupChatsForUser(userId, role) {
  if (role === 'instructor') {
    const { rows } = await db.query(
      `SELECT ig.id AS group_id,
              ig.name AS group_name,
              ig.join_code,
              ${GROUP_MEMBER_COUNT_SQL} AS member_count,
              ${GROUP_ONLINE_COUNT_SQL} AS online_count
       FROM instructor_groups ig
       WHERE ig.instructor_id = $1::uuid
         AND COALESCE(ig.is_system, false) = false
       ORDER BY ig.name ASC`,
      [userId],
    );
    return rows || [];
  }

  if (role === 'student') {
    const { rows } = await db.query(
      `SELECT ig.id AS group_id,
              ig.name AS group_name,
              ig.join_code,
              u.full_name AS instructor_name,
              ${GROUP_MEMBER_COUNT_SQL} AS member_count,
              ${GROUP_ONLINE_COUNT_SQL} AS online_count
       FROM enrollments e
       JOIN instructor_groups ig ON ig.id = e.group_id
       JOIN users u ON u.id = e.instructor_id
       WHERE e.student_id = $1::uuid
         AND e.deleted_at IS NULL
         AND COALESCE(LOWER(TRIM(e.status)), 'active') = 'active'
       ORDER BY ig.name ASC`,
      [userId],
    );
    return rows || [];
  }

  return [];
}

async function listDirectChatsForUser(userId, role) {
  if (role === 'instructor') {
    const { rows } = await db.query(
      `SELECT cr.id AS room_id,
              cr.student_id AS peer_id,
              u.full_name AS peer_name,
              u.last_activity_at,
              cr.updated_at AS last_activity
       FROM chat_rooms cr
       JOIN users u ON u.id = cr.student_id
       WHERE cr.room_kind = 'direct'
         AND cr.instructor_id = $1::uuid
       ORDER BY cr.updated_at DESC NULLS LAST, u.full_name ASC`,
      [userId],
    );
    return mapRowsWithPresence(rows || []);
  }

  if (role === 'student') {
    const { rows } = await db.query(
      `SELECT cr.id AS room_id,
              cr.instructor_id AS peer_id,
              u.full_name AS peer_name,
              u.last_activity_at,
              cr.updated_at AS last_activity
       FROM chat_rooms cr
       JOIN users u ON u.id = cr.instructor_id
       WHERE cr.room_kind = 'direct'
         AND cr.student_id = $1::uuid
       ORDER BY cr.updated_at DESC NULLS LAST, u.full_name ASC`,
      [userId],
    );
    return mapRowsWithPresence(rows || []);
  }

  return [];
}

const ASSIGNMENT_MEMBER_COUNT_SQL = `
  (
    SELECT COUNT(DISTINCT sa.student_id)::int
    FROM student_assignments sa
    WHERE sa.assignment_id = a.id
  ) + 1
`;

const ASSIGNMENT_ONLINE_COUNT_SQL = `
  (
    SELECT COUNT(DISTINCT u.id)::int
    FROM (
      SELECT sa.student_id AS uid
      FROM student_assignments sa
      WHERE sa.assignment_id = a.id
      UNION
      SELECT a.instructor_id AS uid
    ) members
    JOIN users u ON u.id = members.uid
    WHERE u.deleted_at IS NULL
      AND u.last_activity_at >= NOW() - INTERVAL '5 minutes'
  )
`;

async function listAssignmentChatsForUser(userId, role) {
  if (role === 'instructor') {
    const { rows } = await db.query(
      `SELECT a.id AS assignment_id,
              a.title AS assignment_title,
              cr.id AS room_id,
              cr.updated_at AS last_activity,
              ${ASSIGNMENT_MEMBER_COUNT_SQL} AS member_count,
              ${ASSIGNMENT_ONLINE_COUNT_SQL} AS online_count
       FROM assignments a
       LEFT JOIN chat_rooms cr
         ON cr.assignment_id = a.id AND cr.room_kind = 'assignment'
       WHERE a.instructor_id = $1::uuid
       ORDER BY cr.updated_at DESC NULLS LAST, a.title ASC`,
      [userId],
    );
    return rows || [];
  }

  if (role === 'student') {
    const { rows } = await db.query(
      `SELECT a.id AS assignment_id,
              a.title AS assignment_title,
              cr.id AS room_id,
              u.full_name AS instructor_name,
              cr.updated_at AS last_activity,
              ${ASSIGNMENT_MEMBER_COUNT_SQL} AS member_count,
              ${ASSIGNMENT_ONLINE_COUNT_SQL} AS online_count
       FROM student_assignments sa
       JOIN assignments a ON a.id = sa.assignment_id
       JOIN users u ON u.id = a.instructor_id
       LEFT JOIN chat_rooms cr
         ON cr.assignment_id = a.id AND cr.room_kind = 'assignment'
       WHERE sa.student_id = $1::uuid
       ORDER BY cr.updated_at DESC NULLS LAST, a.title ASC`,
      [userId],
    );
    return rows || [];
  }

  return [];
}

async function getChatCapabilities(instructorId) {
  const ent = await resolveEntitlements(instructorId);
  const can_direct_chat = canUseDirectChat(ent.plan);
  let direct_chat_denied_message = null;
  if (!can_direct_chat) {
    direct_chat_denied_message = await directChatDeniedMessage();
  }
  return {
    plan: ent.plan,
    can_group_chat: true,
    can_direct_chat,
    direct_chat_denied_message,
  };
}

module.exports = {
  canUseDirectChat,
  directChatDeniedMessage,
  openRoomForUser,
  listRoomMessages,
  sendRoomMessage,
  listGroupChatsForUser,
  listDirectChatsForUser,
  listAssignmentChatsForUser,
  getChatCapabilities,
  assertInstructorDirectChatAllowed,
  getRoomById,
  assertRoomAccess,
  touchUserActivity,
};
