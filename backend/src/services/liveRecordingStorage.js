const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('../utils/db');

function getUploadsRoot() {
  const env = process.env.UPLOADS_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH;
  if (env && String(env).trim()) return path.resolve(String(env).trim());
  return path.join(__dirname, '../../uploads');
}

function getLiveRecordingsUploadDir() {
  return path.join(getUploadsRoot(), 'live-recordings');
}

function ensureLiveRecordingsUploadDir() {
  const dir = getLiveRecordingsUploadDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function isSafeLiveRecordingFilename(name) {
  return /^[a-f0-9-]{36}\.webm$/i.test(String(name || ''));
}

function getLiveRecordingFilePath(filename) {
  return path.join(getLiveRecordingsUploadDir(), path.basename(filename));
}

function makeShareToken() {
  return crypto.randomBytes(24).toString('base64url');
}

async function upsertLiveRecording({ roomId, instructorId, uploadedByUserId, file, durationSec }) {
  const filename = path.basename(file.filename);
  const byteSize = Number(file.size) || 0;
  const contentType = file.mimetype || 'video/webm';
  const duration = Number(durationSec) > 0 ? Math.round(Number(durationSec)) : null;
  const shareToken = makeShareToken();

  const { rows } = await db.query(
    `INSERT INTO live_recordings (room_id, instructor_id, uploaded_by_user_id, filename, content_type, byte_size, duration_sec, share_token)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (room_id) DO UPDATE SET
       uploaded_by_user_id = EXCLUDED.uploaded_by_user_id,
       filename = EXCLUDED.filename,
       content_type = EXCLUDED.content_type,
       byte_size = EXCLUDED.byte_size,
       duration_sec = EXCLUDED.duration_sec,
       share_token = COALESCE(live_recordings.share_token, EXCLUDED.share_token),
       created_at = NOW()
     RETURNING *`,
    [roomId, instructorId, uploadedByUserId || null, filename, contentType, byteSize, duration, shareToken],
  );
  return rows[0];
}

async function getLiveRecordingByShareToken(shareToken) {
  const { rows } = await db.query(
    `SELECT lr.*, rm.title AS room_title, rm.room_code
     FROM live_recordings lr
     JOIN live_rooms rm ON rm.id = lr.room_id
     WHERE lr.share_token = $1
     LIMIT 1`,
    [shareToken],
  );
  return rows[0] || null;
}

async function deleteLiveRecordingFile(recording) {
  if (!recording?.filename) return;
  const filePath = getLiveRecordingFilePath(recording.filename);
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    /* ignore */
  }
}

async function getLiveRecordingForRoom(roomId) {
  const { rows } = await db.query(`SELECT * FROM live_recordings WHERE room_id = $1 LIMIT 1`, [roomId]);
  return rows[0] || null;
}

async function userCanAccessLiveRecording(user, recording) {
  if (!user || !recording) return false;
  if (user.role === 'admin') return true;
  if (String(recording.instructor_id) === String(user.id)) return true;
  if (user.role === 'student') {
    const { rows } = await db.query(
      `SELECT 1
       FROM live_sessions ls
       JOIN live_rooms lr ON lr.id = ls.room_id
       WHERE lr.id = $1 AND ls.user_id = $2
       LIMIT 1`,
      [recording.room_id, user.id],
    );
    return Boolean(rows[0]);
  }
  return false;
}

async function sendLiveRecordingToResponse(res, filename) {
  const safe = path.basename(filename);
  if (!isSafeLiveRecordingFilename(safe)) {
    res.status(400).json({ success: false, message: 'Yanlış fayl adı' });
    return;
  }
  const filePath = getLiveRecordingFilePath(safe);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ success: false, message: 'Yazı tapılmadı' });
    return;
  }
  res.setHeader('Content-Type', 'video/webm');
  res.setHeader('Content-Disposition', `attachment; filename="${safe}"`);
  fs.createReadStream(filePath).pipe(res);
}

module.exports = {
  ensureLiveRecordingsUploadDir,
  isSafeLiveRecordingFilename,
  upsertLiveRecording,
  getLiveRecordingForRoom,
  getLiveRecordingByShareToken,
  userCanAccessLiveRecording,
  sendLiveRecordingToResponse,
  deleteLiveRecordingFile,
};
