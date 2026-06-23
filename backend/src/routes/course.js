const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  getDashboardStats,
  listTeachers,
  postTeacher,
  listStudents,
  postStudent,
  listGroups,
  postGroup,
  getLeads,
  postLead,
  patchLead,
  getSettings,
  patchSettings,
  postLogo,
  serveCourseLogo,
} = require('../controllers/courseController');

router.get('/settings', authenticate, authorize('course'), getSettings);
router.patch('/settings', authenticate, authorize('course'), patchSettings);
router.post('/settings/logo', authenticate, authorize('course'), postLogo);
router.get('/logo/:filename', authenticate, authorize('course', 'admin'), serveCourseLogo);
router.get('/dashboard-stats', authenticate, authorize('course'), getDashboardStats);
router.get('/teachers', authenticate, authorize('course'), listTeachers);
router.post('/teachers', authenticate, authorize('course'), postTeacher);
router.get('/students', authenticate, authorize('course'), listStudents);
router.post('/students', authenticate, authorize('course'), postStudent);
router.get('/groups', authenticate, authorize('course'), listGroups);
router.post('/groups', authenticate, authorize('course'), postGroup);
router.get('/leads', authenticate, authorize('course'), getLeads);
router.post('/leads', authenticate, authorize('course'), postLead);
router.patch('/leads/:id', authenticate, authorize('course'), patchLead);

module.exports = router;
