const registry = require('../providers/liveLesson/registry');
const { createLiveRoom } = require('./liveRoomService');
const db = require('../utils/db');

/**
 * Create a live lesson via the selected provider.
 * Mentorix Live → existing LiveKit room.
 * Google Meet → Calendar event + Meet link bound to live_rooms row.
 */
async function createLiveLesson(
  instructorId,
  {
    provider: providerRaw = 'mentorix_live',
    groupId = null,
    title = null,
    notifySms = false,
    notifyEmail = false,
    scheduledAt = null,
    durationMinutes = 60,
    attendeeEmails = null,
  } = {},
) {
  const provider = registry.get(providerRaw);
  const providerId = provider.id;

  if (providerId !== 'mentorix_live') {
    const connected = await provider.isConnected(instructorId);
    if (!connected) {
      const err = new Error('Hesabı bağlayın');
      err.status = 409;
      err.code = 'NEEDS_CONNECTION';
      err.provider = providerId;
      throw err;
    }
  }

  const meeting = await provider.createMeeting(instructorId, {
    title,
    scheduledAt,
    durationMinutes,
    attendeeEmails: attendeeEmails || undefined,
    metadata: { groupId },
  });

  const { room, notifications } = await createLiveRoom(instructorId, {
    groupId,
    title,
    notifySms,
    notifyEmail,
    scheduledAt,
    provider: providerId,
    providerMeetingId: meeting.providerMeetingId,
    joinUrl: meeting.joinUrl,
    startUrl: meeting.startUrl,
    passcode: meeting.passcode,
    providerPayload: meeting.raw || {},
    connectionId: meeting.connectionId || null,
  });

  return { room, notifications, provider: providerId, meeting };
}

async function attachProviderFieldsToRoom(roomId, fields) {
  const {
    provider,
    providerMeetingId = null,
    joinUrl = null,
    startUrl = null,
    passcode = null,
    providerPayload = {},
    connectionId = null,
  } = fields;
  const { rows } = await db.query(
    `UPDATE live_rooms SET
       provider = $2,
       provider_meeting_id = $3,
       join_url = $4,
       start_url = $5,
       passcode = $6,
       provider_payload = $7::jsonb,
       connection_id = $8::uuid
     WHERE id = $1::uuid
     RETURNING *`,
    [
      roomId,
      provider,
      providerMeetingId,
      joinUrl,
      startUrl,
      passcode,
      JSON.stringify(providerPayload || {}),
      connectionId,
    ],
  );
  return rows[0];
}

module.exports = {
  createLiveLesson,
  attachProviderFieldsToRoom,
};
