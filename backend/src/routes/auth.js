const router = require('express').Router();
const {
  login,
  register,
  me,
  verifyEmail,
  selectOnboardingRole,
  selectOnboardingPersona,
  updatePersona,
  switchWorkspace,
  signup,
  loginWithEmail,
  resendVerificationEmail,
  googleLogin,
  googleComplete,
  sendMyPhoneVerifyOtp,
  verifyMyPhoneVerifyOtp,
  requestPasswordReset,
  resetPassword,
  googleLinkConfirm,
  googleLinkDecline,
} = require('../controllers/authController');
const { googleOnlyGate } = require('../lib/googleOnlyAuth');
const { patchMyProfile } = require('../controllers/authProfileController');
const {
  bindInstructorPhone,
  instructorPhoneStatus,
} = require('../controllers/instructorPhoneController');
const { authenticate, authorize } = require('../middleware/auth');
const { attachEntitlements, enforceStudentsLimit } = require('../middleware/entitlements');

router.post('/login', googleOnlyGate('login'), login);
router.post('/google/login', googleLogin);
router.post('/google/complete', googleComplete);
router.post('/google/link/confirm', googleLinkConfirm);
router.post('/google/link/decline', googleLinkDecline);

router.post(
  '/register',
  authenticate,
  authorize('admin', 'instructor'),
  attachEntitlements,
  enforceStudentsLimit,
  register
);

router.post('/signup', googleOnlyGate('signup'), signup);
router.post('/login/email', googleOnlyGate('login_email'), loginWithEmail);
router.post('/password/forgot', googleOnlyGate('password_forgot'), requestPasswordReset);
router.post('/password/reset', googleOnlyGate('password_reset'), resetPassword);
router.post('/resend-verification', googleOnlyGate('resend_verification'), resendVerificationEmail);
router.post('/verify-email', googleOnlyGate('verify_email'), verifyEmail);
router.post('/onboarding/role', authenticate, selectOnboardingRole);
router.post('/onboarding/persona', authenticate, selectOnboardingPersona);
router.patch('/persona', authenticate, updatePersona);
router.post('/switch-workspace', authenticate, switchWorkspace);
router.get('/me', authenticate, me);
router.patch('/profile', authenticate, patchMyProfile);
router.get('/instructor/phone-status', authenticate, instructorPhoneStatus);
router.get('/phone-status', authenticate, instructorPhoneStatus);
router.post('/instructor/bind-phone', googleOnlyGate('bind_phone'), authenticate, bindInstructorPhone);
router.post('/phone/send-otp', googleOnlyGate('phone_send_otp'), authenticate, sendMyPhoneVerifyOtp);
router.post('/phone/verify-otp', googleOnlyGate('phone_verify_otp'), authenticate, verifyMyPhoneVerifyOtp);

module.exports = router;
