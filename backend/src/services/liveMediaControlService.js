const { RoomServiceClient } = require('livekit-server-sdk');
const { getLiveRoomRowByCode } = require('./liveRoomService');
const { getLiveKitConfig, livekitHttpUrl } = require('../lib/livekitConfig');
const { isMicTrack, isCameraTrack } = require('../lib/liveMediaTracks');

async function muteRemoteTracks(instructorId, roomCode, identity, { microphone, camera }) {
  const room = await getLiveRoomRowByCode(roomCode);
  if (!room || String(room.instructor_id) !== String(instructorId)) {
    const err = new Error('Otaq tapılmadı');
    err.status = 404;
    throw err;
  }
  if (String(identity) === String(instructorId)) {
    const err = new Error('Öz trekinizi buradan idarə edin');
    err.status = 400;
    throw err;
  }

  let muted = { microphone: false, camera: false };
  try {
    const { apiKey, apiSecret, wsUrl } = getLiveKitConfig();
    const svc = new RoomServiceClient(livekitHttpUrl(wsUrl), apiKey, apiSecret);
    const participants = await svc.listParticipants(room.room_code);
    const participant = (participants || []).find((p) => String(p.identity) === String(identity));
    if (!participant) {
      const err = new Error('İştirakçı tapılmadı');
      err.status = 404;
      throw err;
    }
    for (const track of participant.tracks || []) {
      if (!track?.sid) continue;
      if (microphone === false && isMicTrack(track)) {
        await svc.mutePublishedTrack(room.room_code, identity, track.sid, true);
        muted.microphone = true;
      }
      if (camera === false && isCameraTrack(track)) {
        await svc.mutePublishedTrack(room.room_code, identity, track.sid, true);
        muted.camera = true;
      }
    }
  } catch (e) {
    if (e.status) throw e;
    /* RoomService optional — client data-channel still applies the change */
  }
  return { identity, muted, requested: { microphone, camera } };
}

module.exports = { muteRemoteTracks };
