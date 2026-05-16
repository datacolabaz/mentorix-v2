const { getCourseDashboardStats, getCourseTeachersForOwner } = require('../services/courseService');

const getDashboardStats = async (req, res) => {
  try {
    const stats = await getCourseDashboardStats(req.user.id);
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const listTeachers = async (req, res) => {
  try {
    const data = await getCourseTeachersForOwner(req.user.id);
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getDashboardStats, listTeachers };
