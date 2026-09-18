const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { getOnboarding, patchOnboarding, postAsk } = require('../controllers/mentorController');
const workspace = require('../controllers/mentorWorkspaceController');
const sessionAi = require('../controllers/mentorSessionAiController');
const { generationRateLimit } = require('../middleware/generationRateLimit');

const router = express.Router();

router.use(authenticate);
router.use(authorize('instructor', 'student', 'admin'));

router.get('/onboarding', getOnboarding);
router.patch('/onboarding', patchOnboarding);
router.post('/ask', postAsk);
router.get('/mentee-workspace', authorize('student'), workspace.getMenteeWorkspace);
router.post('/feedback-requests/:id/respond', authorize('student'), workspace.respondToFeedback);
const instructorOnly = authorize('instructor');
router.get('/workspace', instructorOnly, workspace.getWorkspace);
router.post('/goals', instructorOnly, workspace.createGoal);
router.patch('/goals/:id', instructorOnly, workspace.updateGoal);
router.post('/goals/:id/milestones', instructorOnly, workspace.createMilestone);
router.patch('/goals/:id/milestones/:milestoneId', instructorOnly, workspace.updateMilestone);
router.post('/sessions', instructorOnly, workspace.createSession);
router.patch('/sessions/:id', instructorOnly, workspace.updateSession);
router.post('/sessions/:id/ai-summary', instructorOnly, generationRateLimit, sessionAi.generateSessionDraft);
router.post('/sessions/:id/complete', instructorOnly, sessionAi.completeSessionWithDraft);
router.post('/actions', instructorOnly, workspace.createAction);
router.patch('/actions/:id', instructorOnly, workspace.updateAction);
router.post('/services', instructorOnly, workspace.createService);
router.patch('/services/:id', instructorOnly, workspace.updateService);
router.post('/resources', instructorOnly, workspace.createResource);
router.delete('/resources/:id', instructorOnly, workspace.deleteResource);
router.put('/agreements', instructorOnly, workspace.upsertAgreement);
router.patch('/inquiries/:id/status', instructorOnly, workspace.updateInquiryStatus);
router.post('/feedback-requests', instructorOnly, workspace.createFeedbackRequest);

module.exports = router;
