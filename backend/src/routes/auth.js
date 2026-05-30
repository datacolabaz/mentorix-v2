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
} = require('../controllers/authController');
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
router.post('/resend-verification', resendVerificationEmail);
router.post('/verify-email', verifyEmail);
router.post('/onboarding/role', authenticate, selectOnboardingRole);
router.get('/me', authenticate, me);

module.exports = router;
