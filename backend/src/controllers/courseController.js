const {
  getOrgDashboardStats,
  ensureOrgCourseForOwner,
  listLeads,
  createLead,
  updateLead,
  listOrgTeachers,
  LEAD_STATUSES,
} = require('../services/courseOrgService');

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

module.exports = {
  getDashboardStats,
  listTeachers,
  getLeads,
  postLead,
  patchLead,
  LEAD_STATUSES,
};
