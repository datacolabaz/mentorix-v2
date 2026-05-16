const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getDashboardStats } = require('../controllers/courseController');

router.get('/dashboard-stats', authenticate, authorize('course'), getDashboardStats);

module.exports = router;
