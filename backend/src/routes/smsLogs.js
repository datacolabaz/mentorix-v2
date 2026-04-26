const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getSmsLogs } = require('../controllers/smsLogsController');

router.get('/', authenticate, authorize('instructor'), getSmsLogs);

module.exports = router;

