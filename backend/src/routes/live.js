const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getHistory, getRecordingFile, getRecordingUsage, deleteRoom } = require('../controllers/liveRoomController');

/**
 * Internal LiveKit video is retired: live lessons use the teacher's Google Meet / Zoom / other link
 * (/api/live-lessons). Kept only so teachers can see their old sessions and export/delete recordings
 * until the retention decision; every other old endpoint answers 410 with a friendly message.
 */
router.get('/history', authenticate, authorize('instructor'), getHistory);
router.delete('/history/:roomCode', authenticate, authorize('instructor'), deleteRoom);
router.get('/recording-usage', authenticate, authorize('instructor'), getRecordingUsage);
router.get('/recording-file/:filename', authenticate, authorize('instructor', 'student'), getRecordingFile);

const LIVE_ROOM_RETIRED = Object.freeze({
  success: false,
  code: 'LIVE_ROOM_RETIRED',
  message:
    'Mentorix-in daxili video otağı artıq istifadə olunmur. Canlı dərslər müəllimin Google Meet, Zoom və ya digər video platforma linki ilə keçirilir.',
});

router.use((_req, res) => res.status(410).json(LIVE_ROOM_RETIRED));

module.exports = router;
module.exports.LIVE_ROOM_RETIRED = LIVE_ROOM_RETIRED;
