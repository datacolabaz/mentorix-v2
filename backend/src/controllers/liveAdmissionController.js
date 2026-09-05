const {
  requestUserAdmission,
  listPendingAdmissions,
  resolveAdmission,
  getUserAdmissionStatus,
  getGuestAdmissionStatus,
  assertUserMayEnter,
  mapAdmission,
} = require('../services/liveAdmissionService');
const { muteRemoteTracks } = require('../services/liveMediaControlService');
const { getLiveRoomForUser, joinLiveSession } = require('../services/liveRoomService');

function mapRoomLite(row, user) {
  return {
    id: row.id,
    room_code: row.room_code,
    title: row.title,
    status: row.status,
    group_id: row.group_id,
    group_name: row.group_name || null,
    instructor_name: row.instructor_name || null,
    participant_count: row.participant_count,
    started_at: row.started_at,
    ended_at: row.ended_at,
    is_instructor: user?.role === 'instructor' && String(row.instructor_id) === String(user.id),
  };
}

async function postJoinWithAdmission(req, res, nextJoin) {
  try {
    const room = await getLiveRoomForUser(req.params.roomCode, req.user);
    const isInstructor = req.user.role === 'instructor' && String(room.instructor_id) === String(req.user.id);
    if (!isInstructor) {
      const admission = await requestUserAdmission(room, req.user);
      if (admission.status === 'pending') {
        return res.json({
          success: true,
          pending: true,
          admission: mapAdmission(admission),
          room: mapRoomLite(room, req.user),
        });
      }
      if (admission.status === 'denied') {
        return res.status(403).json({
          success: false,
          pending: false,
          denied: true,
          code: 'ADMISSION_DENIED',
          message: 'Müəllim qoşulmanı rədd etdi',
          admission: mapAdmission(admission),
        });
      }
    }
    return nextJoin(room);
  } catch (e) {
    res.status(e.status || 500).json({ success: false, message: e.message || 'Xəta', code: e.code });
  }
}

async function listAdmissions(req, res) {
  try {
    const pending = await listPendingAdmissions(req.user.id, req.params.roomCode);
    res.json({ success: true, pending });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, message: e.message || 'Xəta', code: e.code });
  }
}

async function getMyAdmission(req, res) {
  try {
    const result = await getUserAdmissionStatus(req.params.roomCode, req.user);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, message: e.message || 'Xəta', code: e.code });
  }
}

async function approveAdmission(req, res) {
  try {
    const row = await resolveAdmission(req.user.id, req.params.roomCode, req.params.admissionId, 'approved');
    res.json({ success: true, admission: mapAdmission(row) });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, message: e.message || 'Xəta', code: e.code });
  }
}

async function denyAdmission(req, res) {
  try {
    const row = await resolveAdmission(req.user.id, req.params.roomCode, req.params.admissionId, 'denied');
    res.json({ success: true, admission: mapAdmission(row) });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, message: e.message || 'Xəta', code: e.code });
  }
}

async function getPublicGuestAdmission(req, res) {
  try {
    const result = await getGuestAdmissionStatus(req.params.token, req.params.admissionId, req);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, message: e.message || 'Xəta', code: e.code });
  }
}

async function postParticipantMedia(req, res) {
  try {
    const identity = decodeURIComponent(String(req.params.identity || '').trim());
    const microphone = req.body?.microphone;
    const camera = req.body?.camera;
    const result = await muteRemoteTracks(req.user.id, req.params.roomCode, identity, {
      microphone: typeof microphone === 'boolean' ? microphone : undefined,
      camera: typeof camera === 'boolean' ? camera : undefined,
    });
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, message: e.message || 'Xəta', code: e.code });
  }
}

async function completeApprovedJoin(room, user) {
  const role = user.role === 'instructor' ? 'instructor' : 'student';
  return joinLiveSession(room.id, user.id, role);
}

module.exports = {
  postJoinWithAdmission,
  listAdmissions,
  getMyAdmission,
  approveAdmission,
  denyAdmission,
  getPublicGuestAdmission,
  postParticipantMedia,
  completeApprovedJoin,
  assertUserMayEnter,
  mapRoomLite,
};
