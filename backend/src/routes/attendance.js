const router = require('express').Router();
const { markAttendance, getAttendance } = require('../controllers/attendanceController');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/', authenticate, authorize('instructor', 'admin'), markAttendance);
router.get('/:enrollment_id', authenticate, getAttendance);

module.exports = router;
