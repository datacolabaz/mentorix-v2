const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { generationRateLimit } = require('../middleware/generationRateLimit');
const { postGenerateQuestions, postRegenerateQuestionItem } = require('../controllers/generationController');

const router = express.Router();

router.use(authenticate);
router.use(authorize('instructor'));
router.use(generationRateLimit);

router.post('/questions', postGenerateQuestions);
router.post('/questions/:draftId/regenerate-item', postRegenerateQuestionItem);

module.exports = router;
