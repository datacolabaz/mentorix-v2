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
} = require('../controllers/authController');
const { authenticate, authorize } = require('../middleware/auth');
const { attachEntitlements, enforceStudentsLimit } = require('../middleware/entitlements');

/** Email-based auth only; legacy phone/PIN/Google routes removed from public API. */

router.post('/login', login);

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
