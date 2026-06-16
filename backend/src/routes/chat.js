const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { enforceActiveSubscription } = require('../middleware/entitlements');
const {
  postOpenRoom,
  getMessages,
  postMessage,
  getCapabilities,
} = require('../controllers/chatController');

router.get(
  '/capabilities',
  authenticate,
  authorize('instructor'),
  getCapabilities,
);

router.post(
  '/rooms/open',
  authenticate,
  authorize('instructor', 'student'),
  enforceActiveSubscription,
  postOpenRoom,
);

router.get(
  '/rooms/:roomId/messages',
  authenticate,
  authorize('instructor', 'student'),
  enforceActiveSubscription,
  getMessages,
);

router.post(
  '/rooms/:roomId/messages',
  authenticate,
  authorize('instructor', 'student'),
  enforceActiveSubscription,
  postMessage,
);

module.exports = router;
