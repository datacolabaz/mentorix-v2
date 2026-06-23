const router = require('express').Router();
const { authenticate, authenticateSse, authenticateWithQueryToken, authorize } = require('../middleware/auth');
const {
  postOpenRoom,
  getMessages,
  postMessage,
  getCapabilities,
  streamRoom,
  getGroups,
  getDirect,
  getAssignments,
  postAttachment,
  serveChatAttachment,
} = require('../controllers/chatController');
const { uploadChatAttachment } = require('../services/chatAttachmentStorage');

router.get(
  '/groups',
  authenticate,
  authorize('instructor', 'student'),
  getGroups,
);

router.get(
  '/direct',
  authenticate,
  authorize('instructor', 'student'),
  getDirect,
);

router.get(
  '/assignment-chats',
  authenticate,
  authorize('instructor', 'student'),
  getAssignments,
);

/** @deprecated use /assignment-chats */
router.get(
  '/assignments',
  authenticate,
  authorize('instructor', 'student'),
  getAssignments,
);

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

router.post(
  '/rooms/:roomId/attachments',
  authenticate,
  authorize('instructor', 'student'),
  uploadChatAttachment.single('file'),
  postAttachment,
);

router.get(
  '/attachments/:filename',
  authenticateWithQueryToken,
  authorize('instructor', 'student'),
  serveChatAttachment,
);

router.get(
  '/rooms/:roomId/stream',
  authenticateSse,
  authorize('instructor', 'student'),
  streamRoom,
);

module.exports = router;
