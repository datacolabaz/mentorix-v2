const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  getTeaching,
  patchPublicLabel,
  postSubject,
  deleteSubject,
  postGroup,
  patchGroup,
  deleteGroup,
} = require('../controllers/instructorTeachingController');
const { patchInstructorMapProfile } = require('../controllers/instructorMapProfileController');
const { listClasses, rotateJoinCode } = require('../controllers/instructorClassesController');
const {
  listJoinRequests,
  joinRequestsCount,
  approveRequest,
  rejectRequest,
} = require('../controllers/joinInvitationController');
const { attachEntitlements, enforceStudentsLimit } = require('../middleware/entitlements');

router.get('/teaching', authenticate, authorize('instructor'), getTeaching);
router.get('/join-requests', authenticate, authorize('instructor'), listJoinRequests);
router.get('/join-requests/count', authenticate, authorize('instructor'), joinRequestsCount);
router.post(
  '/join-requests/:id/approve',
  authenticate,
  authorize('instructor'),
  attachEntitlements,
  enforceStudentsLimit,
  approveRequest,
);
router.post('/join-requests/:id/reject', authenticate, authorize('instructor'), rejectRequest);
router.get('/classes', authenticate, authorize('instructor'), listClasses);
router.post('/classes/:id/rotate-join-code', authenticate, authorize('instructor'), rotateJoinCode);
router.patch('/profile-label', authenticate, authorize('instructor'), patchPublicLabel);
router.patch('/map-profile', authenticate, authorize('instructor'), patchInstructorMapProfile);
router.post('/teaching/subjects', authenticate, authorize('instructor'), postSubject);
router.delete('/teaching/subjects/:id', authenticate, authorize('instructor'), deleteSubject);
router.post('/teaching/groups', authenticate, authorize('instructor'), postGroup);
router.patch('/teaching/groups/:id', authenticate, authorize('instructor'), patchGroup);
router.delete('/teaching/groups/:id', authenticate, authorize('instructor'), deleteGroup);

module.exports = router;
