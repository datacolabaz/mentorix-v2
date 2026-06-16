const router = require('express').Router();
const { authenticate, authenticateSse, authorize } = require('../middleware/auth');
const {
  postOpenRoom,
  getMessages,
  postMessage,
  getCapabilities,
  streamRoom,
} = require('../controllers/chatController');

router.get(
  '/capabilities',
  authenticate,
  authorize('instructor'),
  getCapabilities,
);

// Qrup və tapşırıq çatı bütün paketlərdə (SADƏ daxil) aktivdir; fərdi çat plan yoxlaması chatService-dədir.
router.post(
  '/rooms/open',
  authenticate,
  authorize('instructor', 'student'),
  postOpenRoom,
);

router.get(
  '/rooms/:roomId/messages',
  authenticate,
  authorize('instructor', 'student'),
  getMessages,
);

router.post(
  '/rooms/:roomId/messages',
  authenticate,
  authorize('instructor', 'student'),
  postMessage,
);

router.get(
  '/rooms/:roomId/stream',
  authenticateSse,
  authorize('instructor', 'student'),
  streamRoom,
);

module.exports = router;
