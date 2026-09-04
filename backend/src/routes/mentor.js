const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { getOnboarding, patchOnboarding, postAsk } = require('../controllers/mentorController');

const router = express.Router();

router.use(authenticate);
router.use(authorize('instructor', 'student', 'admin'));

router.get('/onboarding', getOnboarding);
router.patch('/onboarding', patchOnboarding);
router.post('/ask', postAsk);

module.exports = router;
