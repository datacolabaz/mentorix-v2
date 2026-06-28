const {
  createLiveRoom,
  getLiveRoomForUser,
  joinLiveSession,
  leaveLiveSession,
  endLiveRoom,
  listInstructorLiveHistory,
  jitsiRoomName,
  getInstructorLiveParticipantLimit,
} = require('../services/liveRoomService');

async function mapRoom(row, user) {
  if (!row) return null;
  const isInstructor = user?.role === 'instructor' && String(row.instructor_id) === String(user.id);
  const maxParticipants = row.instructor_id
    ? await getInstructorLiveParticipantLimit(row.instructor_id)
    : null;
  return {
    id: row.id,
    room_code: row.room_code,
    title: row.title,
    status: row.status,
    group_id: row.group_id,
    group_name: row.group_name || null,
    instructor_name: row.instructor_name || null,
    participant_count: row.participant_count,
    max_participants: maxParticipants,
    live_recording_local: true,
    started_at: row.started_at,
    ended_at: row.ended_at,
    jitsi_room: jitsiRoomName(row.room_code),
    is_instructor: isInstructor,
  };
}

const postCreateRoom = async (req, res) => {
  try {
    const room = await createLiveRoom(req.user.id, {
      groupId: req.body?.group_id || req.body?.groupId || null,
      title: req.body?.title || null,
    });
    const full = await getLiveRoomForUser(room.room_code, req.user).catch(() => room);
    res.status(201).json({ success: true, room: await mapRoom(full, req.user) });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, message: e.message || 'Xəta' });
  }
};

const getRoom = async (req, res) => {
  try {
    const room = await getLiveRoomForUser(req.params.roomCode, req.user);
    res.json({ success: true, room: await mapRoom(room, req.user) });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, message: e.message || 'Xəta' });
  }
};

const postJoin = async (req, res) => {
  try {
    const room = await getLiveRoomForUser(req.params.roomCode, req.user);
    const role = req.user.role === 'instructor' ? 'instructor' : 'student';
    const session = await joinLiveSession(room.id, req.user.id, role);
    res.json({
      success: true,
      session: { id: session.id, joined_at: session.joined_at, role: session.role },
      room: await mapRoom(room, req.user),
    });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, message: e.message || 'Xəta', code: e.code });
  }
};

const postLeave = async (req, res) => {
  try {
    const room = await getLiveRoomForUser(req.params.roomCode, req.user);
    const session = await leaveLiveSession(room.id, req.user.id);
    res.json({ success: true, session });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, message: e.message || 'Xəta' });
  }
};

const postEnd = async (req, res) => {
  try {
    const room = await endLiveRoom(req.user.id, req.params.roomCode);
    res.json({ success: true, room: await mapRoom(room, req.user) });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, message: e.message || 'Xəta' });
  }
};

const getHistory = async (req, res) => {
  try {
    const rows = await listInstructorLiveHistory(req.user.id, { limit: req.query.limit });
    res.json({
      success: true,
      sessions: rows.map((r) => ({
        id: r.id,
        room_code: r.room_code,
        title: r.title,
        group_name: r.group_name,
        status: r.status,
        started_at: r.started_at,
        ended_at: r.ended_at,
        participant_count: r.total_participants || r.participant_count || 0,
        duration_minutes: r.total_minutes || null,
      })),
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || 'Xəta' });
  }
};

module.exports = {
  postCreateRoom,
  getRoom,
  postJoin,
  postLeave,
  postEnd,
  getHistory,
};
