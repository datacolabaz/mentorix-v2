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

async function upsertLiveRecording({ roomId, instructorId, file, durationSec }) {
  const filename = path.basename(file.filename);
  const byteSize = Number(file.size) || 0;
  const contentType = file.mimetype || 'video/webm';
  const duration = Number(durationSec) > 0 ? Math.round(Number(durationSec)) : null;

  const { rows } = await db.query(
    `INSERT INTO live_recordings (room_id, instructor_id, filename, content_type, byte_size, duration_sec)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (room_id) DO UPDATE SET
       filename = EXCLUDED.filename,
       content_type = EXCLUDED.content_type,
       byte_size = EXCLUDED.byte_size,
       duration_sec = EXCLUDED.duration_sec,
       created_at = NOW()
     RETURNING *`,
    [roomId, instructorId, filename, contentType, byteSize, duration],
  );
  return rows[0];
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
  userCanAccessLiveRecording,
  sendLiveRecordingToResponse,
};
