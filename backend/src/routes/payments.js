const router = require('express').Router();
const { listPayments, addPayment, listMyPayments } = require('../controllers/paymentController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/my', authenticate, authorize('student'), listMyPayments);
router.get('/', authenticate, authorize('admin', 'instructor'), listPayments);
router.post('/', authenticate, authorize('admin', 'instructor'), addPayment);

module.exports = router;
