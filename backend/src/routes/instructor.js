const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  getTeaching,
  patchPublicLabel,
  postSubject,
  deleteSubject,
  postGroup,
  deleteGroup,
} = require('../controllers/instructorTeachingController');

router.get('/teaching', authenticate, authorize('instructor'), getTeaching);
router.patch('/profile-label', authenticate, authorize('instructor'), patchPublicLabel);
router.post('/teaching/subjects', authenticate, authorize('instructor'), postSubject);
router.delete('/teaching/subjects/:id', authenticate, authorize('instructor'), deleteSubject);
router.post('/teaching/groups', authenticate, authorize('instructor'), postGroup);
router.delete('/teaching/groups/:id', authenticate, authorize('instructor'), deleteGroup);

module.exports = router;
