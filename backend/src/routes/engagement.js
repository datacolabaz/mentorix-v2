const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const c = require('../controllers/engagementController');

// Tələbə: yalnız öz hadisəsini göndərir
router.post('/materials/:id/events', authenticate, authorize('student'), c.postMaterialEvent);

// Müəllim/admin: engagement məlumatı tələbələrə açıq deyil
const teacher = [authenticate, authorize('instructor', 'admin')];
router.get('/materials', ...teacher, c.listMaterialEngagement);
router.get('/materials/:id', ...teacher, c.getMaterialEngagement);
router.get('/materials/:id/students/:studentId/timeline', ...teacher, c.getMaterialTimeline);
router.patch('/materials/:id/deadline', ...teacher, c.patchMaterialDeadline);
router.post('/materials/:id/reminders/preview', ...teacher, c.postMaterialReminderPreview);
router.post('/materials/:id/reminders', ...teacher, c.postMaterialReminders);
router.get('/assignments', ...teacher, c.listAssignmentEngagement);
router.get('/assignments/:id', ...teacher, c.getAssignmentEngagement);
router.get('/assignments/:id/students/:studentId/timeline', ...teacher, c.getAssignmentTimeline);
router.post('/assignments/:id/reminders/preview', ...teacher, c.postAssignmentReminderPreview);
router.post('/assignments/:id/reminders', ...teacher, c.postAssignmentReminders);
router.get('/exams', ...teacher, c.listExamEngagement);
router.get('/exams/:id', ...teacher, c.getExamEngagement);
router.get('/exams/:id/students/:studentId/timeline', ...teacher, c.getExamTimeline);
router.post('/exams/:id/reminders/preview', ...teacher, c.postExamReminderPreview);
router.post('/exams/:id/reminders', ...teacher, c.postExamReminders);

module.exports = router;
