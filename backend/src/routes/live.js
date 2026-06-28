const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { enforceActiveSubscription } = require('../middleware/entitlements');
const {
  postCreateRoom,
  getRoom,
  postJoin,
  postLeave,
  postEnd,
  getHistory,
} = require('../controllers/liveRoomController');

router.get('/history', authenticate, authorize('instructor'), getHistory);

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

module.exports = router;
