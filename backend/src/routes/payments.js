const router = require('express').Router();
const {
  listPayments,
  addPayment,
  listMyPayments,
  getInstructorPaymentBoard,
  getEnrollmentPaymentHistory,
  getRestorePreview,
  confirmRestorePayments,
  deletePayment,
} = require('../controllers/paymentController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/my', authenticate, authorize('student'), listMyPayments);
router.get('/instructor-board', authenticate, authorize('instructor'), getInstructorPaymentBoard);
router.get(
  '/enrollment/:enrollment_id/history',
  authenticate,
  authorize('admin', 'instructor', 'student'),
  getEnrollmentPaymentHistory
);
router.get(
  '/enrollment/:enrollment_id/restore-preview',
  authenticate,
  authorize('admin', 'instructor'),
  getRestorePreview
);
router.post(
  '/enrollment/:enrollment_id/restore-confirm',
  authenticate,
  authorize('admin', 'instructor'),
  confirmRestorePayments
);
router.get('/', authenticate, authorize('admin', 'instructor'), listPayments);
router.post('/', authenticate, authorize('admin', 'instructor'), addPayment);
router.delete('/:payment_id', authenticate, authorize('admin', 'instructor'), deletePayment);

module.exports = router;
