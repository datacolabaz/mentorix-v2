const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { enforceActiveSubscription } = require('../middleware/entitlements');
const {
  postTransferStudent,
  getTransferStudentPreview,
} = require('../controllers/groupTransferController');

router.get(
  '/transfer-preview',
  authenticate,
  authorize('instructor'),
  getTransferStudentPreview,
);

router.post(
  '/transfer-student',
  authenticate,
  authorize('instructor'),
  enforceActiveSubscription,
  postTransferStudent,
);

module.exports = router;
