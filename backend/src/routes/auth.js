const router = require('express').Router();
const {
  login,
  phoneNextStep,
  forgotPinSms,
  sendOtp,
  verifyOtp,
  register,
  me,
  setPin,
  loginWithPin,
  googleLogin,
  googleComplete,
  googleLinkSendOtp,
  googleLinkVerify,
  sendMyPhoneVerifyOtp,
  verifyMyPhoneVerifyOtp,
} = require('../controllers/authController');
const { authenticate, authorize } = require('../middleware/auth');
const { requireInstructorPhoneVerified } = require('../middleware/trial');
const { attachEntitlements, enforceStudentsLimit } = require('../middleware/entitlements');

/** Phone verify + subscription plan limits (no time-based trial). */
function gateInstructorStudentRegister(req, res, next) {
  if (req.user?.role !== 'instructor') return next();
  if (String(req.body?.role || '').toLowerCase() !== 'student') return next();
  return requireInstructorPhoneVerified(req, res, next);
}

router.post('/login', login);
router.post('/google/login', googleLogin);
router.post('/google/complete', googleComplete);
router.post('/google/link/send-otp', googleLinkSendOtp);
router.post('/google/link/verify', googleLinkVerify);
router.post('/phone/next-step', phoneNextStep);
router.post('/phone/verify/send', authenticate, authorize('instructor'), sendMyPhoneVerifyOtp);
router.post('/phone/verify/confirm', authenticate, authorize('instructor'), verifyMyPhoneVerifyOtp);
router.post('/pin/forgot-sms', forgotPinSms);
router.post('/otp/send', sendOtp);
router.post('/otp/verify', verifyOtp);
router.post(
  '/register',
  authenticate,
  authorize('admin', 'instructor'),
  gateInstructorStudentRegister,
  attachEntitlements,
  enforceStudentsLimit,
  register
);
router.get('/me', authenticate, me);
router.post('/pin/set', authenticate, setPin);
router.post('/pin/login', loginWithPin);

module.exports = router;
