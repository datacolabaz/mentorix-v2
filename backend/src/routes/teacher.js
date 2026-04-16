const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getTeacherDashboardStats } = require('../controllers/teacherController');

router.get('/dashboard-stats', authenticate, authorize('instructor'), getTeacherDashboardStats);

module.exports = router;

