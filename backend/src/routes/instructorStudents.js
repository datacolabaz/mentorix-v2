const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { patchStudentEmail, patchStudentParentEmail } = require('../controllers/studentEmailController');

// Alias namespace requested for instructor tooling:
// PATCH /api/instructor/students/:id/email  -> same handler as /api/students/:id/email
router.patch('/:id/email', authenticate, authorize('admin', 'instructor'), patchStudentEmail);
router.patch('/:id/parent-email', authenticate, authorize('admin', 'instructor'), patchStudentParentEmail);

module.exports = router;
