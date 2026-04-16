const router = require('express').Router();
const { getAdminNotifications, getInstructorNotifications } = require('../controllers/notificationController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/admin', authenticate, authorize('admin'), getAdminNotifications);
router.get('/instructor', authenticate, authorize('instructor'), getInstructorNotifications);
router.get('/student', authenticate, authorize('student'), require('../controllers/notificationController').getStudentNotifications);
router.post('/quick', authenticate, authorize('instructor'), require('../controllers/notificationController').quickInstructorNotification);

module.exports = router;
