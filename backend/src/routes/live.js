const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { enforceActiveSubscription } = require('../middleware/entitlements');
const {
  postCreateRoom,
  getRoom,
  getToken,
  postJoin,
  postLeave,
  postEnd,
  getHistory,
  postRecording,
  getRecordingFile,
  uploadLiveRecording,
} = require('../controllers/liveRoomController');

router.get('/history', authenticate, authorize('instructor'), getHistory);
router.get('/recording-file/:filename', authenticate, authorize('instructor', 'student'), getRecordingFile);

router.post(
  '/create',
  authenticate,
  authorize('instructor'),
  enforceActiveSubscription,
  postCreateRoom,
);

router.post(
  '/rooms',
  authenticate,
  authorize('instructor'),
  enforceActiveSubscription,
  postCreateRoom,
);

router.get('/rooms/:roomCode/token', authenticate, authorize('instructor', 'student'), getToken);
router.get('/rooms/:roomCode', authenticate, authorize('instructor', 'student'), getRoom);
router.post('/rooms/:roomCode/join', authenticate, authorize('instructor', 'student'), postJoin);
router.post('/rooms/:roomCode/leave', authenticate, authorize('instructor', 'student'), postLeave);
router.post(
  '/rooms/:roomCode/end',
  authenticate,
  authorize('instructor'),
  enforceActiveSubscription,
  postEnd,
);

router.post(
  '/rooms/:roomCode/recording',
  authenticate,
  authorize('instructor'),
  enforceActiveSubscription,
  (req, res, next) => {
    uploadLiveRecording.single('recording')(req, res, (err) => {
      if (err) return res.status(400).json({ success: false, message: err.message || 'Fayl qəbul edilmədi' });
      next();
    });
  },
  postRecording,
);

router.get('/:roomCode/token', authenticate, authorize('instructor', 'student'), getToken);
router.get('/:roomCode', authenticate, authorize('instructor', 'student'), getRoom);
router.post('/:roomCode/join', authenticate, authorize('instructor', 'student'), postJoin);
router.post('/:roomCode/leave', authenticate, authorize('instructor', 'student'), postLeave);
router.post(
  '/:roomCode/end',
  authenticate,
  authorize('instructor'),
  enforceActiveSubscription,
  postEnd,
);

router.post(
  '/:roomCode/recording',
  authenticate,
  authorize('instructor'),
  enforceActiveSubscription,
  (req, res, next) => {
    uploadLiveRecording.single('recording')(req, res, (err) => {
      if (err) return res.status(400).json({ success: false, message: err.message || 'Fayl qəbul edilmədi' });
      next();
    });
  },
  postRecording,
);

module.exports = router;
