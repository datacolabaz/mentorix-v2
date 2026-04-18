const router = require('express').Router();
const {
  listPayments,
  addPayment,
  listMyPayments,
  getInstructorPaymentBoard,
  markMonthlyPaid,
  getEnrollmentPaymentHistory,
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
router.get('/', authenticate, authorize('admin', 'instructor'), listPayments);
router.post('/', authenticate, authorize('admin', 'instructor'), addPayment);

module.exports = router;
