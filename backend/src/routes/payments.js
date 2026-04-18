const router = require('express').Router();
const {
  listPayments,
  addPayment,
  listMyPayments,
  getInstructorPaymentBoard,
  markMonthlyPaid,
  markMonthlyPaidBatch,
  getEnrollmentPaymentHistory,
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
router.post('/mark-monthly-paid', authenticate, authorize('admin', 'instructor'), markMonthlyPaid);
router.post('/mark-monthly-paid-batch', authenticate, authorize('admin', 'instructor'), markMonthlyPaidBatch);
router.get('/', authenticate, authorize('admin', 'instructor'), listPayments);
router.post('/', authenticate, authorize('admin', 'instructor'), addPayment);
router.delete('/:payment_id', authenticate, authorize('admin', 'instructor'), deletePayment);

module.exports = router;
