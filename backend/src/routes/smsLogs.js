const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getSmsLogs, getSmsPlan, catchupPackReminders } = require('../controllers/smsLogsController');

router.get('/', authenticate, authorize('instructor'), getSmsLogs);
router.get('/plan', authenticate, authorize('instructor'), getSmsPlan);
router.post('/catchup-packs', authenticate, authorize('instructor'), catchupPackReminders);

module.exports = router;

