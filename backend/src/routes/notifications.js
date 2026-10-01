const router = require('express').Router();
const { getAdminNotifications, getInstructorNotifications } = require('../controllers/notificationController');
const { authenticate, authorize } = require('../middleware/auth');
const center = require('../controllers/notificationCenterController');

router.get('/admin', authenticate, authorize('admin'), getAdminNotifications);
router.get('/instructor', authenticate, authorize('instructor'), getInstructorNotifications);
const {
  getStudentNotifications,
  getStudentNotificationSummary,
  markStudentNotificationRead,
  markAllStudentNotificationsRead,
} = require('../controllers/notificationController');

router.get('/student', authenticate, authorize('student'), getStudentNotifications);
router.get('/student/summary', authenticate, authorize('student'), getStudentNotificationSummary);
router.patch('/student/:id/read', authenticate, authorize('student'), markStudentNotificationRead);
router.post('/student/read-all', authenticate, authorize('student'), markAllStudentNotificationsRead);
router.post('/quick', authenticate, authorize('instructor'), require('../controllers/notificationController').quickInstructorNotification);

// Bildiriş mərkəzi — bütün rollar, yalnız öz bildirişləri.
router.get('/', authenticate, center.listMyNotifications);
router.get('/unread-count', authenticate, center.getMyUnreadCount);
router.get('/preferences', authenticate, center.getMyPreferences);
router.put('/preferences', authenticate, center.updateMyPreferences);
router.post('/read-all', authenticate, center.markAllMyNotificationsRead);
router.patch('/:id/read', authenticate, center.markMyNotificationRead);
router.get('/:id/open', authenticate, center.openMyNotification);

module.exports = router;
