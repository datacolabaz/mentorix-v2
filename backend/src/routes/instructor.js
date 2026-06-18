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
  postPromoteParticipant,
} = require('../controllers/instructorTeachingController');
const { patchInstructorMapProfile } = require('../controllers/instructorMapProfileController');
const { getDiscoverProfile, patchDiscoverProfile } = require('../controllers/instructorDiscoverController');
const {
  getProfessionalDetails,
  patchProfessionalDetails,
} = require('../controllers/instructorProfessionalController');
const { listInstructorInquiries, revealInquiryContact } = require('../controllers/studentInquiryController');
const { listClasses, rotateJoinCode } = require('../controllers/instructorClassesController');
const {
  listJoinRequests,
  joinRequestsDiagnostics,
  joinRequestsCount,
  approveRequest,
  rejectRequest,
} = require('../controllers/joinInvitationController');
const {
  attachEntitlements,
  enforceStudentsLimit,
  enforceActiveSubscription,
} = require('../middleware/entitlements');
const { requireInstructorPhoneVerification } = require('../middleware/requireInstructorPhoneVerification');
const { postInstructorAvatar, deleteInstructorAvatar } = require('../controllers/instructorAvatarController');
const { getMarketplaceOpportunity } = require('../controllers/instructorMarketplaceController');
const {
  postContribution,
  getMyContributions,
} = require('../controllers/universityProgramMentorController');

router.get('/nav-sections', authenticate, authorize('instructor'), getInstructorNavSections);
router.get('/teaching', authenticate, authorize('instructor'), getTeaching);
router.get('/marketplace-opportunity', authenticate, authorize('instructor'), getMarketplaceOpportunity);
router.post('/avatar', authenticate, authorize('instructor'), postInstructorAvatar);
router.delete('/avatar', authenticate, authorize('instructor'), deleteInstructorAvatar);
router.get('/join-requests', authenticate, authorize('instructor'), listJoinRequests);
router.get('/join-requests/diagnostics', authenticate, authorize('instructor'), joinRequestsDiagnostics);
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
router.get('/professional-details', authenticate, authorize('instructor'), getProfessionalDetails);
router.patch('/professional-details', authenticate, authorize('instructor'), patchProfessionalDetails);
router.get('/discover-profile', authenticate, authorize('instructor'), getDiscoverProfile);
router.patch('/discover-profile', authenticate, authorize('instructor'), patchDiscoverProfile);
router.get('/inquiries', authenticate, authorize('instructor'), listInstructorInquiries);
router.post('/inquiries/:id/reveal-contact', authenticate, authorize('instructor'), revealInquiryContact);
router.post(
  '/teaching/subjects',
  authenticate,
  authorize('instructor'),
  enforceActiveSubscription,
  postSubject,
);
router.delete(
  '/teaching/subjects/:id',
  authenticate,
  authorize('instructor'),
  enforceActiveSubscription,
  deleteSubject,
);
router.post(
  '/teaching/groups',
  authenticate,
  authorize('instructor'),
  requireInstructorPhoneVerification({ trigger: 'group' }),
  enforceActiveSubscription,
  postGroup,
);
router.patch(
  '/teaching/groups/:id',
  authenticate,
  authorize('instructor'),
  enforceActiveSubscription,
  patchGroup,
);
router.delete(
  '/teaching/groups/:id',
  authenticate,
  authorize('instructor'),
  enforceActiveSubscription,
  deleteGroup,
);
router.post(
  '/teaching/promote-participant',
  authenticate,
  authorize('instructor'),
  enforceActiveSubscription,
  postPromoteParticipant,
);

router.post('/university-programs', authenticate, authorize('instructor'), postContribution);
router.get('/university-programs/mine', authenticate, authorize('instructor'), getMyContributions);

module.exports = router;
