const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getDashboardStats, listTeachers } = require('../controllers/courseController');

router.get('/dashboard-stats', authenticate, authorize('course'), getDashboardStats);
router.get('/teachers', authenticate, authorize('course'), listTeachers);

module.exports = router;
