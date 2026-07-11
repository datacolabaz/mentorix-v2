const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { generationRateLimit } = require('../middleware/generationRateLimit');
const {
  postGenerateQuestions,
  postRegenerateQuestionItem,
  patchDraftContent,
} = require('../controllers/generationController');

const router = express.Router();

router.use(authenticate);
router.use(authorize('instructor'));
router.use(generationRateLimit);

router.post('/questions', postGenerateQuestions);
router.post('/questions/:draftId/regenerate-item', postRegenerateQuestionItem);
router.patch('/drafts/:draftId', patchDraftContent);

module.exports = router;
