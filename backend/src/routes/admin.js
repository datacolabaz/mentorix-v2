const router = require('express').Router();
const {
  getInstructors, updateInstructorLimits,
  getDashboardStats, toggleInstructor,
} = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/stats', authenticate, authorize('admin'), getDashboardStats);
router.get('/instructors', authenticate, authorize('admin'), getInstructors);
router.patch('/instructors/:id/limits', authenticate, authorize('admin'), updateInstructorLimits);
router.patch('/instructors/:id/toggle', authenticate, authorize('admin'), toggleInstructor);

module.exports = router;
