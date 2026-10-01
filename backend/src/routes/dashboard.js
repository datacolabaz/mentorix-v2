const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const c = require('../controllers/dashboardSummaryController');

// Rol controller-də yoxlanılır (admin | instructor | student); qalan rollar 403 alır.
router.get('/summary', authenticate, c.getSummary);
router.get('/admin/operations', authenticate, authorize('admin'), c.getAdminOperations);

module.exports = router;
