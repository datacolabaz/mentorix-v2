const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { enforceActiveSubscription } = require('../middleware/entitlements');
const {
  listTeacherConnections,
  startTeacherConnection,
  googleMeetOAuthCallback,
  disconnectTeacherConnection,
} = require('../controllers/teacherConnectionsController');

// OAuth callback — no auth header (browser redirect from Google)
router.get('/google_meet/callback', googleMeetOAuthCallback);
router.get('/google-meet/callback', googleMeetOAuthCallback);

router.get('/', authenticate, authorize('instructor'), listTeacherConnections);

router.post(
  '/:provider/start',
  authenticate,
  authorize('instructor'),
  enforceActiveSubscription,
  startTeacherConnection,
);

router.delete(
  '/:provider',
  authenticate,
  authorize('instructor'),
  disconnectTeacherConnection,
);

module.exports = router;
