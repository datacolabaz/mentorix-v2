const {
  createGuestInvite,
  revokeGuestInvite,
  getActiveGuestInviteForRoom,
  joinAsGuest,
  leaveGuestParticipant,
  getPublicInviteInfo,
} = require('../services/liveGuestService');
const { publicJoinUrl } = require('../lib/frontendBaseUrl');

async function getPublicLiveGuestInvite(req, res) {
  try {
    const info = await getPublicInviteInfo(req.params.token);
    res.json({ success: true, ...info });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, message: e.message || 'Xəta', code: e.code });
  }
}

async function postPublicLiveGuestJoin(req, res) {
  try {
    const result = await joinAsGuest(req.params.token, req.body || {}, req);
    const status = result?.pending ? 200 : 201;
    res.status(status).json({ success: true, ...result });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, message: e.message || 'Xəta', code: e.code });
  }
}

async function postPublicLiveGuestLeave(req, res) {
  try {
    const participantId = String(req.body?.participantId || req.body?.participant_id || '').trim();
    if (!participantId) {
      return res.status(400).json({ success: false, message: 'participantId tələb olunur' });
    }
    const row = await leaveGuestParticipant(participantId);
    res.json({ success: true, left: Boolean(row) });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, message: e.message || 'Xəta' });
  }
}

async function postGuestInvite(req, res) {
  try {
    const result = await createGuestInvite(req.user.id, req.params.roomCode);
    res.status(201).json({
      success: true,
      invite: {
        token: result.invite.token,
        expires_at: result.invite.expires_at,
        join_url: publicJoinUrl(result.join_path, req),
        join_path: result.join_path,
      },
      room_code: result.room.room_code,
    });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, message: e.message || 'Xəta' });
  }
}

async function deleteGuestInvite(req, res) {
  try {
    const row = await revokeGuestInvite(req.user.id, req.params.roomCode);
    res.json({ success: true, revoked: Boolean(row) });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, message: e.message || 'Xəta' });
  }
}

async function getGuestInvite(req, res) {
  try {
    const invite = await getActiveGuestInviteForRoom(req.user.id, req.params.roomCode);
    res.json({
      success: true,
      invite: invite
        ? {
            ...invite,
            join_url: publicJoinUrl(invite.join_path, req),
          }
        : null,
    });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, message: e.message || 'Xəta' });
  }
}

module.exports = {
  getPublicLiveGuestInvite,
  postPublicLiveGuestJoin,
  postPublicLiveGuestLeave,
  postGuestInvite,
  deleteGuestInvite,
  getGuestInvite,
};
