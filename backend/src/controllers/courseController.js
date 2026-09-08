const path = require('path');
const fs = require('fs');
const multer = require('multer');
const {
  getOrgDashboardStats,
  getOrgWorkspace,
  getOrgSettingsByCourse,
  updateOrgSettings,
  updateOrgLogo,
  listLeads,
  createLead,
  updateLead,
  listOrgTeachers,
  addOrgTeacher,
  setOrgTeacherActive,
  removeOrgTeacher,
  listOrgStudents,
  addOrgStudent,
  listOrgGroups,
  createOrgGroup,
  LEAD_STATUSES,
} = require('../services/courseOrgService');
const { hasPermission } = require('../services/orgRbacService');
const orgWorkspace = require('../services/orgWorkspaceService');

const uploadsCourseLogosDir = path.join(__dirname, '../../uploads/course-logos');
fs.mkdirSync(uploadsCourseLogosDir, { recursive: true });

const uploadLogo = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsCourseLogosDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
      cb(null, `course-${req.user.id}${ext}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('Yalnız şəkil faylı qəbul olunur'));
    }
    cb(null, true);
  },
}).single('logo');

async function withOrgWorkspace(req, res, permission, handler) {
  try {
    const org = await getOrgWorkspace(req.user.id);
    if (permission && !hasPermission(org.permissions, permission)) {
      return res.status(403).json({ success: false, message: 'Bu əməliyyat üçün icazəniz yoxdur' });
    }
    return await handler(org, res);
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
}

function sendCsv(res, filename, csv) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

const getMe = (req, res) =>
  withOrgWorkspace(req, res, null, async (org) => {
    const settings = await getOrgSettingsByCourse(org.course);
    res.json({
      success: true,
      workspace: {
        course_id: org.course.id,
        course_name: settings.course_name,
        logo_url: settings.logo_url,
        role_key: org.roleKey,
        is_owner: org.isOwner,
        permissions: org.permissions,
        needs_branding: settings.needs_branding,
      },
    });
  });

const getDashboardStats = (req, res) =>
  withOrgWorkspace(req, res, 'dashboard.view', async () => {
    const stats = await getOrgDashboardStats(req.user.id);
    res.json({ success: true, stats });
  });

const getOverview = (req, res) =>
  withOrgWorkspace(req, res, 'dashboard.view', async (org) => {
    const overview = await orgWorkspace.getOrgOverview(org.course.id, req.user.id);
    const settings = await getOrgSettingsByCourse(org.course);
    res.json({
      success: true,
      overview: {
        ...overview,
        course_id: org.course.id,
        course_name: settings.course_name,
        logo_url: settings.logo_url,
        needs_branding: settings.needs_branding,
        role_key: org.roleKey,
        permissions: org.permissions,
      },
    });
  });

const listTeachers = (req, res) =>
  withOrgWorkspace(req, res, 'trainers.view', async (org) => {
    const teachers = await listOrgTeachers(org.course.id, org.course.owner_user_id);
    res.json({ success: true, course_id: org.course.id, teachers });
  });

const postTeacher = (req, res) =>
  withOrgWorkspace(req, res, 'trainers.invite', async () => {
    const teacher = await addOrgTeacher(req.user.id, req.body?.phone);
    res.status(201).json({ success: true, teacher });
  });

const patchTeacher = (req, res) =>
  withOrgWorkspace(req, res, 'trainers.manage', async (org) => {
    const action = String(req.body?.action || '').toLowerCase();
    if (action === 'suspend') {
      const teachers = await setOrgTeacherActive(org.course.id, req.params.id, false, req.user.id);
      return res.json({ success: true, teachers });
    }
    if (action === 'activate') {
      const teachers = await setOrgTeacherActive(org.course.id, req.params.id, true, req.user.id);
      return res.json({ success: true, teachers });
    }
    if (req.body?.team_id !== undefined) {
      await orgWorkspace.setTrainerTeam(org.course.id, req.params.id, req.body.team_id || null, req.user.id);
    }
    if (req.body?.role_key) {
      await orgWorkspace.ensureStaffMembership(org.course.id, req.params.id, req.body.role_key);
      await orgWorkspace.updateMemberRole(org.course.id, req.params.id, req.body.role_key, req.user.id);
    }
    const teachers = await listOrgTeachers(org.course.id, org.course.owner_user_id);
    res.json({ success: true, teachers });
  });

const deleteTeacher = (req, res) =>
  withOrgWorkspace(req, res, 'trainers.manage', async (org) => {
    await removeOrgTeacher(org.course.id, req.params.id, req.user.id);
    res.json({ success: true });
  });

const getTeacherActivity = (req, res) =>
  withOrgWorkspace(req, res, 'trainers.view', async (org) => {
    const detail = await orgWorkspace.listTrainerDetail(org.course.id, req.params.id);
    res.json({ success: true, ...detail });
  });

const listStudents = (req, res) =>
  withOrgWorkspace(req, res, 'users.view', async (org) => {
    const students = await listOrgStudents(org.course.id);
    res.json({ success: true, course_id: org.course.id, students });
  });

const postStudent = (req, res) =>
  withOrgWorkspace(req, res, 'users.create', async () => {
    const student = await addOrgStudent(req.user.id, req.body?.phone);
    res.status(201).json({ success: true, student, participant: student });
  });

const listParticipants = (req, res) =>
  withOrgWorkspace(req, res, 'users.view', async (org) => {
    const participants = await orgWorkspace.listOrgParticipants(org.course.id, req.query);
    res.json({ success: true, course_id: org.course.id, participants });
  });

const postParticipantsBulk = (req, res) =>
  withOrgWorkspace(req, res, null, async (org) => {
    const action = String(req.body?.action || '').toLowerCase();
    const ids = req.body?.participant_ids || req.body?.user_ids || [];
    const perm =
      action === 'assign_assessment'
        ? 'assessments.edit'
        : action === 'archive'
          ? 'users.delete'
          : 'users.edit';
    if (!hasPermission(org.permissions, perm)) {
      return res.status(403).json({ success: false, message: 'Bu əməliyyat üçün icazəniz yoxdur' });
    }
    if (action === 'archive') {
      const participants = await orgWorkspace.archiveParticipants(org.course.id, ids, req.user.id);
      return res.json({ success: true, participants });
    }
    if (action === 'add_to_team') {
      const team = await orgWorkspace.addParticipantsToTeam(org.course.id, req.body.team_id, ids, req.user.id);
      return res.json({ success: true, team });
    }
    if (action === 'add_to_group') {
      await orgWorkspace.addParticipantsToGroup(org.course.id, req.body.group_id, ids, req.user.id);
      const participants = await orgWorkspace.listOrgParticipants(org.course.id);
      return res.json({ success: true, participants });
    }
    if (action === 'assign_assessment') {
      await orgWorkspace.assignAssessments(org.course.id, req.body.exam_id, ids, req.user.id);
      const participants = await orgWorkspace.listOrgParticipants(org.course.id);
      return res.json({ success: true, participants });
    }
    res.status(400).json({ success: false, message: 'Naməlum əməliyyat' });
  });

const exportParticipants = (req, res) =>
  withOrgWorkspace(req, res, 'reports.export', async (org) => {
    const csv = await orgWorkspace.exportParticipantsCsv(org.course.id, req.query);
    sendCsv(res, 'istirakcilar.csv', csv);
  });

const listGroups = (req, res) =>
  withOrgWorkspace(req, res, 'groups.view', async (org) => {
    const groups = await listOrgGroups(org.course.id);
    res.json({ success: true, course_id: org.course.id, groups });
  });

const postGroup = (req, res) =>
  withOrgWorkspace(req, res, 'groups.create', async (org) => {
    const group = await createOrgGroup(org.course.id, req.user.id, req.body);
    res.status(201).json({ success: true, group });
  });

const postGroupMembers = (req, res) =>
  withOrgWorkspace(req, res, 'groups.edit', async (org) => {
    await orgWorkspace.addParticipantsToGroup(
      org.course.id,
      req.params.id,
      req.body?.participant_ids || req.body?.user_ids || [],
      req.user.id,
    );
    const groups = await listOrgGroups(org.course.id);
    res.json({ success: true, groups });
  });

const listTeams = (req, res) =>
  withOrgWorkspace(req, res, 'teams.view', async (org) => {
    const teams = await orgWorkspace.listOrgTeams(org.course.id);
    res.json({ success: true, teams });
  });

const postTeam = (req, res) =>
  withOrgWorkspace(req, res, 'teams.create', async (org) => {
    const team = await orgWorkspace.createOrgTeam(org.course.id, req.body, req.user.id);
    res.status(201).json({ success: true, team });
  });

const getTeam = (req, res) =>
  withOrgWorkspace(req, res, 'teams.view', async (org) => {
    const team = await orgWorkspace.getTeamDetail(org.course.id, req.params.id);
    res.json({ success: true, team });
  });

const patchTeam = (req, res) =>
  withOrgWorkspace(req, res, 'teams.edit', async (org) => {
    const team = await orgWorkspace.updateOrgTeam(org.course.id, req.params.id, req.body, req.user.id);
    res.json({ success: true, team });
  });

const postTeamMembers = (req, res) =>
  withOrgWorkspace(req, res, 'teams.edit', async (org) => {
    const team = await orgWorkspace.addParticipantsToTeam(
      org.course.id,
      req.params.id,
      req.body?.participant_ids || req.body?.user_ids || [],
      req.user.id,
    );
    res.json({ success: true, team });
  });

const listExams = (req, res) =>
  withOrgWorkspace(req, res, 'assessments.view', async (org) => {
    const exams = await orgWorkspace.listOrgExams(org.course.id, { status: req.query.status });
    res.json({ success: true, exams });
  });

const exportExams = (req, res) =>
  withOrgWorkspace(req, res, 'reports.export', async (org) => {
    const csv = await orgWorkspace.exportExamsCsv(org.course.id, { status: req.query.status });
    sendCsv(res, 'teskilat-imtahanalari.csv', csv);
  });

const listQuestions = (req, res) =>
  withOrgWorkspace(req, res, 'content.view', async (org) => {
    const questions = await orgWorkspace.listOrgQuestions(org.course.id, req.query);
    res.json({ success: true, questions });
  });

const listMaterials = (req, res) =>
  withOrgWorkspace(req, res, 'content.view', async (org) => {
    const materials = await orgWorkspace.listOrgMaterials(org.course.id);
    res.json({ success: true, materials });
  });

const getAnalytics = (req, res) =>
  withOrgWorkspace(req, res, 'reports.view', async (org) => {
    const analytics = await orgWorkspace.getOrgAnalytics(org.course.id, req.query);
    res.json({ success: true, analytics });
  });

const exportAnalytics = (req, res) =>
  withOrgWorkspace(req, res, 'reports.export', async (org) => {
    const csv = await orgWorkspace.exportAnalyticsCsv(org.course.id, req.query);
    await orgWorkspace.writeOrgAudit({
      courseId: org.course.id,
      actorUserId: req.user.id,
      action: 'report.exported',
      targetType: 'report',
      metadata: { kind: 'analytics' },
    });
    sendCsv(res, 'teskilat-hesabati.csv', csv);
  });

const listMembers = (req, res) =>
  withOrgWorkspace(req, res, 'organization.manage', async (org) => {
    const members = await orgWorkspace.listOrgMembers(org.course.id);
    res.json({ success: true, members });
  });

const patchMemberRole = (req, res) =>
  withOrgWorkspace(req, res, 'roles.manage', async (org) => {
    const members = await orgWorkspace.updateMemberRole(
      org.course.id,
      req.params.id,
      req.body?.role_key,
      req.user.id,
    );
    res.json({ success: true, members });
  });

const getRoles = (req, res) =>
  withOrgWorkspace(req, res, 'roles.manage', async () => {
    const { permissionCatalog } = require('../services/orgRbacService');
    const roles = await orgWorkspace.listOrgRoles();
    res.json({ success: true, roles, permissions: permissionCatalog() });
  });

const listAudit = (req, res) =>
  withOrgWorkspace(req, res, 'audit.view', async (org) => {
    const events = await orgWorkspace.listOrgAudit(org.course.id, {
      limit: req.query.limit,
      offset: req.query.offset,
    });
    res.json({ success: true, events });
  });

const listNotifications = (req, res) =>
  withOrgWorkspace(req, res, 'notifications.manage', async () => {
    const notifications = await orgWorkspace.listOrgNotifications(req.user.id);
    res.json({ success: true, notifications });
  });

const getLeads = (req, res) =>
  withOrgWorkspace(req, res, 'users.view', async (org) => {
    const leads = await listLeads(org.course.id, { status: req.query.status });
    res.json({ success: true, course_id: org.course.id, leads, statuses: LEAD_STATUSES });
  });

const postLead = (req, res) =>
  withOrgWorkspace(req, res, 'users.create', async (org) => {
    const lead = await createLead(org.course.id, req.body);
    res.status(201).json({ success: true, lead });
  });

const patchLead = (req, res) =>
  withOrgWorkspace(req, res, 'users.edit', async (org) => {
    const lead = await updateLead(org.course.id, req.params.id, req.body);
    res.json({ success: true, lead });
  });

const getSettings = (req, res) =>
  withOrgWorkspace(req, res, 'organization.manage', async (org) => {
    const settings = await getOrgSettingsByCourse(org.course);
    res.json({ success: true, settings });
  });

const patchSettings = (req, res) =>
  withOrgWorkspace(req, res, 'organization.manage', async (org) => {
    const settings = await updateOrgSettings(org.course.owner_user_id, req.body);
    res.json({ success: true, settings });
  });

const postLogo = (req, res) => {
  uploadLogo(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message || 'Yükləmə xətası' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Loqo faylı seçin' });
    }
    try {
      const org = await getOrgWorkspace(req.user.id);
      if (!hasPermission(org.permissions, 'organization.manage')) {
        return res.status(403).json({ success: false, message: 'Bu əməliyyat üçün icazəniz yoxdur' });
      }
      const rel = `/api/course/logo/${req.file.filename}`;
      const settings = await updateOrgLogo(org.course.owner_user_id, rel);
      res.json({ success: true, settings, logo_url: rel });
    } catch (e) {
      res.status(e.statusCode || 500).json({ success: false, message: e.message });
    }
  });
};

const serveCourseLogo = (req, res) => {
  try {
    const filename = path.basename(String(req.params.filename || ''));
    if (!filename.startsWith('course-')) {
      return res.status(404).json({ success: false, message: 'Fayl tapılmadı' });
    }

    const ownerPrefix = `course-${req.user.id}`;
    const isOwner = filename.startsWith(ownerPrefix);
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
    }

    const filePath = path.join(uploadsCourseLogosDir, filename);
    const resolved = path.resolve(filePath);
    const root = path.resolve(uploadsCourseLogosDir);
    if (!resolved.startsWith(root) || !fs.existsSync(resolved)) {
      return res.status(404).json({ success: false, message: 'Fayl tapılmadı' });
    }

    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.sendFile(resolved);
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

module.exports = {
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
  LEAD_STATUSES,
};

