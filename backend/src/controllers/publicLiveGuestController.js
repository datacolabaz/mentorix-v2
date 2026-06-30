const {
  createGuestInvite,
  revokeGuestInvite,
  getActiveGuestInviteForRoom,
  joinAsGuest,
  leaveGuestParticipant,
  getPublicInviteInfo,
} = require('../services/liveGuestService');

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
    res.status(201).json({ success: true, ...result });
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
    const appBase = String(process.env.APP_URL || process.env.FRONTEND_URL || '').replace(/\/$/, '');
    res.status(201).json({
      success: true,
      invite: {
        token: result.invite.token,
        expires_at: result.invite.expires_at,
        join_url: appBase ? `${appBase}${result.join_path}` : result.join_path,
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
    const appBase = String(process.env.APP_URL || process.env.FRONTEND_URL || '').replace(/\/$/, '');
    res.json({
      success: true,
      invite: invite
        ? {
            ...invite,
            join_url: appBase ? `${appBase}${invite.join_path}` : invite.join_path,
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
