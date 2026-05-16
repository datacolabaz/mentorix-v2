const { getCourseDashboardStats } = require('../services/courseService');

const getDashboardStats = async (req, res) => {
  try {
    const stats = await getCourseDashboardStats(req.user.id);
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getDashboardStats };
