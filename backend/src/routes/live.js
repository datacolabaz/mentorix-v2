const router = require('express').Router();
const { authenticate, authorize, optionalAuthenticate } = require('../middleware/auth');
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
  deleteRoom,
  uploadLiveRecording,
} = require('../controllers/liveRoomController');
const {
  postGuestInvite,
  deleteGuestInvite,
  getGuestInvite,
} = require('../controllers/publicLiveGuestController');
const {
  listAdmissions,
  getMyAdmission,
  approveAdmission,
  denyAdmission,
  postParticipantMedia,
} = require('../controllers/liveAdmissionController');
const { uploadLiveChatAttachment } = require('../services/liveChatAttachmentStorage');
const {
  multerFail,
  postAuthedChatAttachment,
  postAuthedChatMessage,
  getAuthedChatHistory,
  serveLiveChatAttachment,
} = require('../controllers/liveChatAttachmentController');

function liveChatUpload(req, res, next) {
  uploadLiveChatAttachment.single('file')(req, res, (err) => {
    if (multerFail(err, res)) return;
    next();
  });
}

function liveChatDownloadAuth(req, res, next) {
  if (!req.headers.authorization?.split(' ')[1] && req.query?.token && !req.query?.invite) {
    req.headers.authorization = `Bearer ${String(req.query.token).trim()}`;
  }
  return optionalAuthenticate(req, res, next);
}

router.get('/chat-attachments/:filename', liveChatDownloadAuth, serveLiveChatAttachment);
router.post(
  '/rooms/:roomCode/chat-attachments',
  authenticate,
  authorize('instructor', 'student'),
  liveChatUpload,
  postAuthedChatAttachment,
);
router.post(
  '/:roomCode/chat-attachments',
  authenticate,
  authorize('instructor', 'student'),
  liveChatUpload,
  postAuthedChatAttachment,
);
router.get(
  '/rooms/:roomCode/chat-messages',
  authenticate,
  authorize('instructor', 'student'),
  getAuthedChatHistory,
);
router.get(
  '/:roomCode/chat-messages',
  authenticate,
  authorize('instructor', 'student'),
  getAuthedChatHistory,
);
router.post(
  '/rooms/:roomCode/chat-messages',
  authenticate,
  authorize('instructor', 'student'),
  postAuthedChatMessage,
);
router.post(
  '/:roomCode/chat-messages',
  authenticate,
  authorize('instructor', 'student'),
  postAuthedChatMessage,
);

router.get('/history', authenticate, authorize('instructor'), getHistory);
router.delete('/history/:roomCode', authenticate, authorize('instructor'), deleteRoom);
router.get('/recording-file/:filename', authenticate, authorize('instructor', 'student'), getRecordingFile);

router.post(
  '/rooms/:roomCode/guest-invite',
  authenticate,
  authorize('instructor'),
  enforceActiveSubscription,
  postGuestInvite,
);
router.delete(
  '/rooms/:roomCode/guest-invite',
  authenticate,
  authorize('instructor'),
  enforceActiveSubscription,
  deleteGuestInvite,
);
router.get(
  '/rooms/:roomCode/guest-invite',
  authenticate,
  authorize('instructor'),
  getGuestInvite,
);

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
router.get('/rooms/:roomCode/admissions', authenticate, authorize('instructor'), listAdmissions);
router.get('/rooms/:roomCode/admission', authenticate, authorize('instructor', 'student'), getMyAdmission);
router.post(
  '/rooms/:roomCode/admissions/:admissionId/approve',
  authenticate,
  authorize('instructor'),
  approveAdmission,
);
router.post(
  '/rooms/:roomCode/admissions/:admissionId/deny',
  authenticate,
  authorize('instructor'),
  denyAdmission,
);
router.post(
  '/rooms/:roomCode/participants/:identity/media',
  authenticate,
  authorize('instructor'),
  postParticipantMedia,
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

router.post(
  '/rooms/:roomCode/recording',
  authenticate,
  authorize('instructor', 'student'),
  (req, res, next) => {
    uploadLiveRecording.single('recording')(req, res, (err) => {
      if (err) return res.status(400).json({ success: false, message: err.message || 'Fayl qəbul edilmədi' });
      next();
    });
  },
  postRecording,
);

router.get('/:roomCode/token', authenticate, authorize('instructor', 'student'), getToken);
router.get('/:roomCode/admissions', authenticate, authorize('instructor'), listAdmissions);
router.get('/:roomCode/admission', authenticate, authorize('instructor', 'student'), getMyAdmission);
router.post(
  '/:roomCode/admissions/:admissionId/approve',
  authenticate,
  authorize('instructor'),
  approveAdmission,
);
router.post(
  '/:roomCode/admissions/:admissionId/deny',
  authenticate,
  authorize('instructor'),
  denyAdmission,
);
router.post(
  '/:roomCode/participants/:identity/media',
  authenticate,
  authorize('instructor'),
  postParticipantMedia,
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

router.post(
  '/:roomCode/recording',
  authenticate,
  authorize('instructor', 'student'),
  (req, res, next) => {
    uploadLiveRecording.single('recording')(req, res, (err) => {
      if (err) return res.status(400).json({ success: false, message: err.message || 'Fayl qəbul edilmədi' });
      next();
    });
  },
  postRecording,
);

module.exports = router;
