const router = require('express').Router();
const { login, sendOtp, verifyOtp, register, me } = require('../controllers/authController');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/login', login);
router.post('/otp/send', sendOtp);
router.post('/otp/verify', verifyOtp);
router.post('/register', authenticate, authorize('admin', 'instructor'), register);
router.get('/me', authenticate, me);

module.exports = router;
