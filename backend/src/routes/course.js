const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  getDashboardStats,
  listTeachers,
  getLeads,
  postLead,
  patchLead,
} = require('../controllers/courseController');

router.get('/dashboard-stats', authenticate, authorize('course'), getDashboardStats);
router.get('/teachers', authenticate, authorize('course'), listTeachers);
router.get('/leads', authenticate, authorize('course'), getLeads);
router.post('/leads', authenticate, authorize('course'), postLead);
router.patch('/leads/:id', authenticate, authorize('course'), patchLead);

module.exports = router;
