const router = require('express').Router();
const { listPayments, addPayment } = require('../controllers/paymentController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, authorize('admin', 'instructor'), listPayments);
router.post('/', authenticate, authorize('admin', 'instructor'), addPayment);

module.exports = router;
