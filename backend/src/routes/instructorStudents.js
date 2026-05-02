const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { patchStudentEmail } = require('../controllers/studentEmailController');

// Alias namespace requested for instructor tooling:
// PATCH /api/instructor/students/:id/email  -> same handler as /api/students/:id/email
router.patch('/:id/email', authenticate, authorize('admin', 'instructor'), patchStudentEmail);

module.exports = router;
