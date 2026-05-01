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
} = require('../controllers/authController');
const { authenticate, authorize } = require('../middleware/auth');
const {
  requireInstructorPhoneVerified,
  checkTrialActive,
  checkStudentLimit,
  checkDailyStudentLimit,
} = require('../middleware/trial');

function enforceTrialForStudentRegister(req, res, next) {
  // Only gate instructor-created students. Admin should be unrestricted.
  if (req.user?.role !== 'instructor') return next();
  // Only enforce when the instructor is registering a student.
  if (String(req.body?.role || '').toLowerCase() !== 'student') return next();
  return requireInstructorPhoneVerified(req, res, (e1) => {
    if (e1) return next(e1);
    return checkTrialActive(req, res, (e2) => {
      if (e2) return next(e2);
      return checkStudentLimit(req, res, (e3) => {
        if (e3) return next(e3);
        return checkDailyStudentLimit(req, res, next);
      });
    });
  });
}

router.post('/login', login);
router.post('/phone/next-step', phoneNextStep);
router.post('/pin/forgot-sms', forgotPinSms);
router.post('/otp/send', sendOtp);
router.post('/otp/verify', verifyOtp);
router.post('/register', authenticate, authorize('admin', 'instructor'), enforceTrialForStudentRegister, register);
router.get('/me', authenticate, me);
router.post('/pin/set', authenticate, setPin);
router.post('/pin/login', loginWithPin);

module.exports = router;
