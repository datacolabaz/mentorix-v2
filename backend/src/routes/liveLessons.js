const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { enforceActiveSubscription } = require('../middleware/entitlements');
const { userRateLimit } = require('../middleware/userRateLimit');
const c = require('../controllers/liveLessonController');

const writeLimit = userRateLimit({ name: 'live-lessons-write', windowMs: 10 * 60 * 1000, max: 40 });
const readLimit = userRateLimit({ name: 'live-lessons-read', windowMs: 60 * 1000, max: 120 });

router.get('/providers', authenticate, authorize('instructor'), c.listProviders);

router.get('/', authenticate, authorize('instructor', 'student'), readLimit, c.listLessons);
router.get('/code/:roomCode', authenticate, readLimit, c.getLessonByCode);
router.get('/:id', authenticate, readLimit, c.getLesson);
router.get('/:id/calendar.ics', authenticate, readLimit, c.getCalendarFile);

router.post('/', authenticate, authorize('instructor'), enforceActiveSubscription, writeLimit, c.postCreateLesson);
router.patch('/:id', authenticate, authorize('instructor'), writeLimit, c.patchLesson);
router.post('/:id/cancel', authenticate, authorize('instructor'), writeLimit, c.postCancelLesson);

router.get('/:id/attendance', authenticate, authorize('instructor'), c.getAttendance);
router.put('/:id/attendance', authenticate, authorize('instructor'), writeLimit, c.putAttendance);

module.exports = router;
