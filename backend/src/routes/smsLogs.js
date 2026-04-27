const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getSmsLogs, getSmsPlan } = require('../controllers/smsLogsController');

router.get('/', authenticate, authorize('instructor'), getSmsLogs);
router.get('/plan', authenticate, authorize('instructor'), getSmsPlan);

module.exports = router;

