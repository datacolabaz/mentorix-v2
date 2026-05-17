const path = require('path');
const fs = require('fs');
const multer = require('multer');
const {
  getOrgDashboardStats,
  ensureOrgCourseForOwner,
  getOrgSettings,
  updateOrgSettings,
  updateOrgLogo,
  listLeads,
  createLead,
  updateLead,
  listOrgTeachers,
  addOrgTeacher,
  listOrgStudents,
  addOrgStudent,
  listOrgGroups,
  createOrgGroup,
  LEAD_STATUSES,
} = require('../services/courseOrgService');

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

async function withOrgCourse(req, res, handler) {
  try {
    const course = await ensureOrgCourseForOwner(req.user.id);
    return await handler(course, res);
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
}

const getDashboardStats = (req, res) =>
  withOrgCourse(req, res, async () => {
    const stats = await getOrgDashboardStats(req.user.id);
    res.json({ success: true, stats });
  });

const listTeachers = (req, res) =>
  withOrgCourse(req, res, async (course) => {
    const teachers = await listOrgTeachers(course.id, req.user.id);
    res.json({ success: true, course_id: course.id, teachers });
  });

const postTeacher = (req, res) =>
  withOrgCourse(req, res, async () => {
    const teacher = await addOrgTeacher(req.user.id, req.body?.phone);
    res.status(201).json({ success: true, teacher });
  });

const listStudents = (req, res) =>
  withOrgCourse(req, res, async (course) => {
    const students = await listOrgStudents(course.id);
    res.json({ success: true, course_id: course.id, students });
  });

const postStudent = (req, res) =>
  withOrgCourse(req, res, async () => {
    const student = await addOrgStudent(req.user.id, req.body?.phone);
    res.status(201).json({ success: true, student });
  });

const listGroups = (req, res) =>
  withOrgCourse(req, res, async (course) => {
    const groups = await listOrgGroups(course.id);
    res.json({ success: true, course_id: course.id, groups });
  });

const postGroup = (req, res) =>
  withOrgCourse(req, res, async (course) => {
    const group = await createOrgGroup(course.id, req.user.id, req.body);
    res.status(201).json({ success: true, group });
  });

const getLeads = (req, res) =>
  withOrgCourse(req, res, async (course) => {
    const leads = await listLeads(course.id, { status: req.query.status });
    res.json({ success: true, course_id: course.id, leads, statuses: LEAD_STATUSES });
  });

const postLead = (req, res) =>
  withOrgCourse(req, res, async (course) => {
    const lead = await createLead(course.id, req.body);
    res.status(201).json({ success: true, lead });
  });

const patchLead = (req, res) =>
  withOrgCourse(req, res, async (course) => {
    const lead = await updateLead(course.id, req.params.id, req.body);
    res.json({ success: true, lead });
  });

const getSettings = (req, res) =>
  withOrgCourse(req, res, async () => {
    const settings = await getOrgSettings(req.user.id);
    res.json({ success: true, settings });
  });

const patchSettings = (req, res) =>
  withOrgCourse(req, res, async () => {
    const settings = await updateOrgSettings(req.user.id, req.body);
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
      const rel = `/api/uploads/course-logos/${req.file.filename}`;
      const settings = await updateOrgLogo(req.user.id, rel);
      res.json({ success: true, settings, logo_url: rel });
    } catch (e) {
      res.status(e.statusCode || 500).json({ success: false, message: e.message });
    }
  });
};

module.exports = {
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
  LEAD_STATUSES,
};
