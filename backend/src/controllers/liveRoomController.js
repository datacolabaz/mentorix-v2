const { AccessToken } = require('livekit-server-sdk');
const { checkSmsQuota } = require('../services/smsQuotaService');
const crypto = require('crypto');
const multer = require('multer');
const db = require('../utils/db');
const {
  createLiveRoom,
  getLiveRoomForUser,
  getLiveRoomForRecordingUpload,
  joinLiveSession,
  leaveLiveSession,
  endLiveRoom,
  deleteLiveRoomForInstructor,
  listInstructorLiveHistory,
  jitsiRoomName,
  getInstructorLiveParticipantLimit,
} = require('../services/liveRoomService');
const {
  ensureLiveRecordingsUploadDir,
  upsertLiveRecording,
  userCanAccessLiveRecording,
  sendLiveRecordingToResponse,
  getLiveRecordingByShareToken,
  ensureRecordingShareTokenByRoomId,
} = require('../services/liveRecordingStorage');
const { listGuestsForRoom } = require('../services/liveGuestService');

const liveRecordingsDir = ensureLiveRecordingsUploadDir();
const uploadLiveRecording = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, liveRecordingsDir),
    filename: (_req, _file, cb) => cb(null, `${crypto.randomUUID()}.webm`),
  }),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /video\/webm/i.test(file.mimetype || '') || /\.webm$/i.test(file.originalname || '');
    if (!ok) return cb(new Error('Yalnız .webm yazı faylı qəbul edilir'));
    cb(null, true);
  },
});

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
    const notifySms = Boolean(req.body?.notify_sms ?? req.body?.notifySms);
    const notifyEmail = Boolean(req.body?.notify_email ?? req.body?.notifyEmail);

    if (notifySms) {
      const quota = await checkSmsQuota(req.user.id);
      if (!quota.ok) {
        return res.status(quota.statusCode || 429).json(quota.body);
      }
    }

    const { room, notifications } = await createLiveRoom(req.user.id, {
      groupId: req.body?.group_id || req.body?.groupId || null,
      title: req.body?.title || null,
      notifySms,
      notifyEmail,
    });
    const full = await getLiveRoomForUser(room.room_code, req.user).catch(() => room);
    res.status(201).json({
      success: true,
      room: await mapRoom(full, req.user),
      notifications: notifications || { sms: 0, email: 0 },
    });
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

const getToken = async (req, res) => {
  try {
    const apiKey = String(process.env.LIVEKIT_API_KEY || '').trim();
    const apiSecret = String(process.env.LIVEKIT_API_SECRET || '').trim();
    const wsUrl = String(
      process.env.LIVEKIT_WS_URL ||
        process.env.LIVEKIT_URL ||
        process.env.NEXT_PUBLIC_LIVEKIT_URL ||
        '',
    )
      .trim()
      .replace(/^https:\/\//i, 'wss://')
      .replace(/^http:\/\//i, 'ws://');

    if (!apiKey || !apiSecret || !wsUrl) {
      return res.status(503).json({
        success: false,
        message:
          'LiveKit konfiqurasiya olunmayıb. Backend service-də LIVEKIT_API_KEY, LIVEKIT_API_SECRET və LIVEKIT_WS_URL (wss://...) əlavə edin.',
      });
    }

    const room = await getLiveRoomForUser(req.params.roomCode, req.user);
    const isInstructor =
      req.user.role === 'instructor' && String(room.instructor_id) === String(req.user.id);

    const at = new AccessToken(apiKey, apiSecret, {
      identity: String(req.user.id),
      name: req.user.full_name || 'İştirakçı',
      ttl: '4h',
    });

    at.addGrant({
      roomJoin: true,
      room: room.room_code,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      roomAdmin: isInstructor,
    });

    const token = await at.toJwt();
    res.json({ success: true, token, wsUrl });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, message: e.message || 'Xəta' });
  }
};

const getHistory = async (req, res) => {
  try {
    const rows = await listInstructorLiveHistory(req.user.id, { limit: req.query.limit });
    const sessions = await Promise.all(
      rows.map(async (r) => {
        let shareToken = r.recording_share_token || null;
        if (r.recording_filename && !shareToken) {
          shareToken = await ensureRecordingShareTokenByRoomId(r.id);
        }
        const guests = await listGuestsForRoom(r.id);
        return {
          id: r.id,
          room_code: r.room_code,
          title: r.title,
          group_name: r.group_name,
          status: r.status,
          started_at: r.started_at,
          ended_at: r.ended_at,
          participant_count: r.total_participants || r.participant_count || 0,
          guest_count: guests.length,
          guests: guests.map((g) => ({
            id: g.id,
            full_name: g.full_name,
            email: g.email,
            phone_number: g.phone_number,
            joined_at: g.joined_at,
            left_at: g.left_at,
            duration_minutes: g.duration_minutes,
          })),
          duration_minutes: r.total_minutes || null,
          has_recording: Boolean(r.recording_filename),
          recording_url: r.recording_filename
            ? `/live/recording-file/${encodeURIComponent(r.recording_filename)}`
            : null,
          recording_duration_sec: r.recording_duration_sec || null,
          recorded_by_name: r.recorded_by_name || null,
          share_url: shareToken ? `/lr/${shareToken}` : null,
        };
      }),
    );
    res.json({ success: true, sessions });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || 'Xəta' });
  }
};

const postRecording = async (req, res) => {
  try {
    const room = await getLiveRoomForRecordingUpload(req.params.roomCode, req.user);
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Yazı faylı tələb olunur' });
    }

    const durationSec = Number(req.body?.duration_sec || req.body?.durationSec || 0) || null;
    const row = await upsertLiveRecording({
      roomId: room.id,
      instructorId: room.instructor_id,
      uploadedByUserId: req.user.id,
      file: req.file,
      durationSec,
    });

    res.status(201).json({
      success: true,
      recording: {
        url: `/live/recording-file/${encodeURIComponent(row.filename)}`,
        share_url: row.share_token ? `/lr/${row.share_token}` : null,
        duration_sec: row.duration_sec,
        byte_size: row.byte_size,
      },
    });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, message: e.message || 'Xəta' });
  }
};

const deleteRoom = async (req, res) => {
  try {
    const result = await deleteLiveRoomForInstructor(req.user.id, req.params.roomCode);
    res.json({ success: true, room_code: result.room_code });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, message: e.message || 'Xəta' });
  }
};

const getPublicRecording = async (req, res) => {
  try {
    const recording = await getLiveRecordingByShareToken(String(req.params.shareToken || '').trim());
    if (!recording?.filename) {
      return res.status(404).json({ success: false, message: 'Yazı tapılmadı' });
    }
    return sendLiveRecordingToResponse(res, recording.filename);
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || 'Xəta' });
  }
};

const getPublicRecordingInfo = async (req, res) => {
  try {
    const recording = await getLiveRecordingByShareToken(String(req.params.shareToken || '').trim());
    if (!recording) {
      return res.status(404).json({ success: false, message: 'Yazı tapılmadı' });
    }
    res.json({
      success: true,
      recording: {
        title: recording.room_title,
        room_code: recording.room_code,
        duration_sec: recording.duration_sec,
        download_url: `/api/public/live-recording/${encodeURIComponent(recording.share_token)}`,
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || 'Xəta' });
  }
};

const getRecordingFile = async (req, res) => {
  try {
    const filename = String(req.params.filename || '').trim();
    const { rows } = await db.query(`SELECT * FROM live_recordings WHERE filename = $1 LIMIT 1`, [filename]);
    const recording = rows[0];
    if (!recording) {
      return res.status(404).json({ success: false, message: 'Yazı tapılmadı' });
    }
    const ok = await userCanAccessLiveRecording(req.user, recording);
    if (!ok) {
      return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
    }
    return sendLiveRecordingToResponse(res, filename);
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || 'Xəta' });
  }
};

module.exports = {
  postCreateRoom,
  getRoom,
  getToken,
  postJoin,
  postLeave,
  postEnd,
  getHistory,
  postRecording,
  getRecordingFile,
  deleteRoom,
  getPublicRecording,
  getPublicRecordingInfo,
  uploadLiveRecording,
};
