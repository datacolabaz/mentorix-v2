const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  getMe,
  getDashboardStats,
  getOverview,
  listTeachers,
  postTeacher,
  patchTeacher,
  deleteTeacher,
  getTeacherActivity,
  listStudents,
  postStudent,
  listParticipants,
  postParticipantsBulk,
  exportParticipants,
  listGroups,
  postGroup,
  postGroupMembers,
  listTeams,
  postTeam,
  getTeam,
  patchTeam,
  postTeamMembers,
  listExams,
  exportExams,
  listQuestions,
  listMaterials,
  getAnalytics,
  exportAnalytics,
  listMembers,
  patchMemberRole,
  getRoles,
  listAudit,
  listNotifications,
  getLeads,
  postLead,
  patchLead,
  getSettings,
  patchSettings,
  postLogo,
  serveCourseLogo,
} = require('../controllers/courseController');

const course = [authenticate, authorize('course')];

router.get('/me', ...course, getMe);
router.get('/settings', ...course, getSettings);
router.patch('/settings', ...course, patchSettings);
router.post('/settings/logo', ...course, postLogo);
router.get('/logo/:filename', authenticate, authorize('course', 'admin'), serveCourseLogo);
router.get('/dashboard-stats', ...course, getDashboardStats);
router.get('/overview', ...course, getOverview);

router.get('/teachers', ...course, listTeachers);
router.post('/teachers', ...course, postTeacher);
router.patch('/teachers/:id', ...course, patchTeacher);
router.delete('/teachers/:id', ...course, deleteTeacher);
router.get('/teachers/:id/activity', ...course, getTeacherActivity);

router.get('/students', ...course, listStudents);
router.post('/students', ...course, postStudent);
router.get('/participants', ...course, listParticipants);
router.post('/participants/bulk', ...course, postParticipantsBulk);
router.get('/participants/export', ...course, exportParticipants);

router.get('/groups', ...course, listGroups);
router.post('/groups', ...course, postGroup);
router.post('/groups/:id/members', ...course, postGroupMembers);

router.get('/teams', ...course, listTeams);
router.post('/teams', ...course, postTeam);
router.get('/teams/:id', ...course, getTeam);
router.patch('/teams/:id', ...course, patchTeam);
router.post('/teams/:id/members', ...course, postTeamMembers);

router.get('/exams', ...course, listExams);
router.get('/exams/export', ...course, exportExams);
router.get('/questions', ...course, listQuestions);
router.get('/materials', ...course, listMaterials);
router.get('/analytics', ...course, getAnalytics);
router.get('/analytics/export', ...course, exportAnalytics);

router.get('/members', ...course, listMembers);
router.patch('/members/:id/role', ...course, patchMemberRole);
router.get('/roles', ...course, getRoles);
router.get('/audit', ...course, listAudit);
router.get('/notifications', ...course, listNotifications);

router.get('/leads', ...course, getLeads);
router.post('/leads', ...course, postLead);
router.patch('/leads/:id', ...course, patchLead);

module.exports = router;
