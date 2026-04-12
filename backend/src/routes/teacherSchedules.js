const router = require('express').Router();
const {
  listMine,
  forEnrollment,
  createSlot,
  generateSlots,
  deleteSlot,
  blockSlot,
  unblockSlot,
} = require('../controllers/teacherScheduleController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/for-enrollment', authenticate, authorize('instructor'), forEnrollment);
router.get('/', authenticate, authorize('instructor', 'admin'), listMine);
router.post('/', authenticate, authorize('instructor', 'admin'), createSlot);
router.post('/generate', authenticate, authorize('instructor', 'admin'), generateSlots);
router.delete('/:id', authenticate, authorize('instructor', 'admin'), deleteSlot);
router.patch('/:id/block', authenticate, authorize('instructor', 'admin'), blockSlot);
router.patch('/:id/unblock', authenticate, authorize('instructor', 'admin'), unblockSlot);

module.exports = router;
