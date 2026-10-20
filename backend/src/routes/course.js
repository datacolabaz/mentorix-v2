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

// Organization cabinet: the active 'course' role AND an organization the caller owns or belongs to.
// Organizations are never created implicitly here (only by an approved «Təşkilat yarat» request).
const requireOrgAccess = async (req, res, next) => {
  try {
    const { userHasOrgAccess } = require('../services/courseOrgService');
    if (await userHasOrgAccess(req.user.id)) return next();
    return res.status(403).json({
      success: false,
      code: 'ORG_REQUIRED',
      message: 'Təşkilat tapılmadı. «Kabinetlərim» bölməsindən «Təşkilat yarat» sorğusu göndərin.',
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server xətası' });
  }
};
const course = [authenticate, authorize('course'), requireOrgAccess];

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
