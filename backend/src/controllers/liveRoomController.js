/**
 * Legacy internal-video (LiveKit) sessions: read-only history and recording export for the teacher.
 * Creating/joining rooms is retired (routes/live.js answers 410); new lessons use /api/live-lessons.
 */
const db = require('../utils/db');
const { deleteLiveRoomForInstructor, listInstructorLiveHistory } = require('../services/liveRoomService');
const { userCanAccessLiveRecording, sendLiveRecordingToResponse } = require('../services/liveRecordingStorage');
const { listGuestsForRoom } = require('../services/liveGuestService');
const { getRecordingUsageSnapshot } = require('../services/liveRecordingQuotaService');

const getHistory = async (req, res) => {
  try {
    const rows = await listInstructorLiveHistory(req.user.id, { limit: req.query.limit });
    const sessions = await Promise.all(
      rows.map(async (r) => {
        const guests = await listGuestsForRoom(r.id);
        return {
          id: r.id,
          room_code: r.room_code,
          title: r.title,
          group_name: r.group_name,
          status: r.status,
          provider: r.provider || 'mentorix_live',
          join_url: r.join_url || null,
          started_at: r.started_at,
          scheduled_at: r.scheduled_at || null,
          ended_at: r.ended_at,
          participant_count: r.total_participants || r.participant_count || 0,
          guest_count: guests.length,
          connection_account_email: r.connection_account_email || null,
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
        };
      }),
    );
    res.json({ success: true, sessions });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || 'Xəta' });
  }
};

const getRecordingUsage = async (req, res) => {
  try {
    const usage = await getRecordingUsageSnapshot(req.user.id);
    res.json({ success: true, usage });
  } catch (e) {
    res.status(e.status || e.statusCode || 500).json({ success: false, message: e.message || 'Xəta' });
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

const getRecordingFile = async (req, res) => {
  try {
    const filename = String(req.params.filename || '').trim();
    const { rows } = await db.query(`SELECT * FROM live_recordings WHERE filename = $1 LIMIT 1`, [filename]);
    const recording = rows[0];
    if (!recording || recording.deleted_at || (recording.expires_at && new Date(recording.expires_at) <= new Date())) {
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
  getHistory,
  getRecordingFile,
  getRecordingUsage,
  deleteRoom,
};
