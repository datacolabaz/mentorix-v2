const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const c = require('../controllers/engagementController');

// Tələbə: yalnız öz hadisəsini göndərir
router.post('/materials/:id/events', authenticate, authorize('student'), c.postMaterialEvent);

// Müəllim/admin: engagement məlumatı tələbələrə açıq deyil
const teacher = [authenticate, authorize('instructor', 'admin')];
router.get('/materials', ...teacher, c.listMaterialEngagement);
router.get('/materials/:id', ...teacher, c.getMaterialEngagement);
router.patch('/materials/:id/deadline', ...teacher, c.patchMaterialDeadline);
router.post('/materials/:id/reminders', ...teacher, c.postMaterialReminders);
router.get('/assignments', ...teacher, c.listAssignmentEngagement);
router.get('/assignments/:id', ...teacher, c.getAssignmentEngagement);
router.post('/assignments/:id/reminders', ...teacher, c.postAssignmentReminders);

module.exports = router;
