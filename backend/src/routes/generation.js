const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { generationRateLimit } = require('../middleware/generationRateLimit');
const { postGenerateQuestions } = require('../controllers/generationController');

const router = express.Router();

router.use(authenticate);
router.use(authorize('instructor'));
router.use(generationRateLimit);

router.post('/questions', postGenerateQuestions);

module.exports = router;
