const router = require('express').Router();
const {
  login,
  register,
  me,
  verifyEmail,
  selectOnboardingRole,
  signup,
  loginWithEmail,
  resendVerificationEmail,
  googleLogin,
  googleComplete,
  sendMyPhoneVerifyOtp,
  verifyMyPhoneVerifyOtp,
  requestPasswordReset,
  resetPassword,
} = require('../controllers/authController');
const { patchMyProfile } = require('../controllers/authProfileController');
const {
  bindInstructorPhone,
  instructorPhoneStatus,
} = require('../controllers/instructorPhoneController');
const { authenticate, authorize } = require('../middleware/auth');
const { attachEntitlements, enforceStudentsLimit } = require('../middleware/entitlements');

router.post('/login', login);
router.post('/google/login', googleLogin);
router.post('/google/complete', googleComplete);

router.post(
  '/register',
  authenticate,
  authorize('admin', 'instructor'),
  attachEntitlements,
  enforceStudentsLimit,
  register
);

router.post('/signup', signup);
router.post('/login/email', loginWithEmail);
router.post('/password/forgot', requestPasswordReset);
router.post('/password/reset', resetPassword);
router.post('/resend-verification', resendVerificationEmail);
router.post('/verify-email', verifyEmail);
router.post('/onboarding/role', authenticate, selectOnboardingRole);
router.get('/me', authenticate, me);
router.patch('/profile', authenticate, patchMyProfile);
router.get('/instructor/phone-status', authenticate, instructorPhoneStatus);
router.get('/phone-status', authenticate, instructorPhoneStatus);
router.post('/instructor/bind-phone', authenticate, bindInstructorPhone);
router.post('/phone/send-otp', authenticate, sendMyPhoneVerifyOtp);
router.post('/phone/verify-otp', authenticate, verifyMyPhoneVerifyOtp);

module.exports = router;
