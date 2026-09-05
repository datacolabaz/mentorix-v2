const db = require('../utils/db');
const {
  getLiveRoomForUser,
  getLiveRoomRowByCode,
  userCanAccessLiveRoom,
} = require('../services/liveRoomService');
const { getInviteByToken, assertInviteActive } = require('../services/liveGuestService');
const {
  insertLiveChatAttachment,
  getLiveChatAttachmentByFilename,
  sendLiveChatFile,
} = require('../services/liveChatAttachmentStorage');

function multerFail(err, res) {
  if (!err) return false;
  if (err.code === 'LIMIT_FILE_SIZE') {
    res.status(400).json({ success: false, message: 'Fayl 5 MB-dan böyük ola bilməz' });
    return true;
  }
  res.status(err.statusCode || 400).json({ success: false, message: err.message || 'Fayl qəbul edilmədi' });
  return true;
}

async function assertActiveGuest(inviteToken, participantId, roomId) {
  const invite = await getInviteByToken(inviteToken);
  assertInviteActive(invite);
  if (roomId && String(invite.room_id) !== String(roomId)) {
    const err = new Error('İcazə yoxdur');
    err.status = 403;
    throw err;
  }
  const { rows } = await db.query(
    `SELECT * FROM live_guest_participants
     WHERE id = $1 AND room_id = $2 AND left_at IS NULL
     LIMIT 1`,
    [participantId, invite.room_id],
  );
  if (!rows[0]) {
    const err = new Error('Qonaq sessiyası tapılmadı');
    err.status = 403;
    throw err;
  }
  return { invite, participant: rows[0], roomId: invite.room_id };
}

async function postAuthedChatAttachment(req, res) {
  try {
    const room = await getLiveRoomForUser(req.params.roomCode, req.user);
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Fayl tələb olunur' });
    }
    const attachment = await insertLiveChatAttachment({
      roomId: room.id,
      file: req.file,
      userId: req.user.id,
    });
    res.status(201).json({ success: true, attachment });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, message: e.message || 'Xəta' });
  }
}

async function postGuestChatAttachment(req, res) {
  try {
    const participantId = String(req.body?.participantId || req.body?.participant_id || '').trim();
    if (!participantId) {
      return res.status(400).json({ success: false, message: 'participantId tələb olunur' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Fayl tələb olunur' });
    }
    const { participant, roomId } = await assertActiveGuest(req.params.token, participantId);
    const attachment = await insertLiveChatAttachment({
      roomId,
      file: req.file,
      guestParticipantId: participant.id,
    });
    res.status(201).json({ success: true, attachment });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, message: e.message || 'Xəta', code: e.code });
  }
}

async function serveLiveChatAttachment(req, res) {
  try {
    const row = await getLiveChatAttachmentByFilename(req.params.filename);
    if (!row) return res.status(404).json({ success: false, message: 'Fayl tapılmadı' });

    if (req.user) {
      const room = await getLiveRoomRowByCode(row.room_code);
      const ok = room && (await userCanAccessLiveRoom(req.user, room));
      if (!ok) return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
      return sendLiveChatFile(res, row);
    }

    const inviteToken = String(req.query.invite || req.query.token || '').trim();
    const participantId = String(req.query.participantId || req.query.participant_id || '').trim();
    if (!inviteToken || !participantId) {
      return res.status(401).json({ success: false, message: 'Token yoxdur' });
    }
    await assertActiveGuest(inviteToken, participantId, row.room_id);
    return sendLiveChatFile(res, row);
  } catch (e) {
    res.status(e.status || 500).json({ success: false, message: e.message || 'Xəta' });
  }
}

module.exports = {
  multerFail,
  postAuthedChatAttachment,
  postGuestChatAttachment,
  serveLiveChatAttachment,
};
