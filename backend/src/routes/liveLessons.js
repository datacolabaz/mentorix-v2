const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { enforceActiveSubscription } = require('../middleware/entitlements');
const { listProviders, postCreateLiveLesson } = require('../controllers/liveLessonController');

router.get('/providers', authenticate, authorize('instructor'), listProviders);

router.post(
  '/',
  authenticate,
  authorize('instructor'),
  enforceActiveSubscription,
  postCreateLiveLesson,
);

module.exports = router;
