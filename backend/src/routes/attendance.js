const router = require('express').Router();
const {
  markAttendance,
  getAttendance,
  getAttendancePeriod,
  upsertAttendanceLesson,
  bulkFillAttendancePeriod,
} = require('../controllers/attendanceController');
const monthlyAttendance = require('../controllers/monthlyAttendanceController');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/', authenticate, authorize('instructor', 'admin'), markAttendance);
router.get(
  '/monthly/:enrollment_id',
  authenticate,
  authorize('instructor', 'admin'),
  monthlyAttendance.listMonthlySlots
);
router.post(
  '/monthly/:enrollment_id/generate',
  authenticate,
  authorize('instructor', 'admin'),
  monthlyAttendance.generateMonthlySlots
);
router.post(
  '/monthly/:enrollment_id/bulk',
  authenticate,
  authorize('instructor', 'admin'),
  monthlyAttendance.bulkMonthlySlots
);
router.put(
  '/monthly/:enrollment_id/day',
  authenticate,
  authorize('instructor', 'admin'),
  monthlyAttendance.putMonthlyDay
);
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
