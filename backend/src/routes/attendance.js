const router = require('express').Router();
const {
  markAttendance,
  getAttendance,
  getAttendancePeriod,
  upsertAttendanceLesson,
  bulkFillAttendancePeriod,
} = require('../controllers/attendanceController');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/', authenticate, authorize('instructor', 'admin'), markAttendance);
router.post(
  '/period/bulk-fill',
  authenticate,
  authorize('instructor', 'admin'),
  bulkFillAttendancePeriod
);
router.get('/period/:enrollment_id', authenticate, getAttendancePeriod);
router.put('/period/:enrollment_id', authenticate, authorize('instructor', 'admin'), upsertAttendanceLesson);
router.get('/:enrollment_id', authenticate, getAttendance);

module.exports = router;
