const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { enforceActiveSubscription } = require('../middleware/entitlements');
const {
  listTeacherConnections,
  startTeacherConnection,
  googleMeetOAuthCallback,
  zoomOAuthCallback,
  disconnectTeacherConnection,
} = require('../controllers/teacherConnectionsController');

// OAuth callbacks — no auth header (browser redirect from provider)
router.get('/google_meet/callback', googleMeetOAuthCallback);
router.get('/google-meet/callback', googleMeetOAuthCallback);
router.get('/zoom/callback', zoomOAuthCallback);

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
