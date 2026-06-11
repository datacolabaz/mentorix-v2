const express = require('express');
const { getLandingStats } = require('../controllers/publicLandingController');
const { getPublicLoginMarketing } = require('../controllers/siteMarketingController');
const { getInstructorsInMapView } = require('../controllers/publicInstructorMapController');
const { getInstructorDiscovery } = require('../controllers/publicInstructorDiscoverController');
const {
  getCategoriesTree,
  getCategoriesSearch,
  getCategoryBySlugHandler,
  getPopularCategories,
  getServiceAreas,
} = require('../controllers/publicCategoriesController');
const { postPublicInquiry } = require('../controllers/studentInquiryController');
const { getActivePlansList } = require('../services/subscriptionPlansService');
const { getPublicJoin } = require('../controllers/joinInvitationController');
const { getPublicExamInvite, postPublicExamGuestJoin } = require('../controllers/publicExamInviteController');
const { getPublicTaskInvite, postPublicTaskGuestJoin } = require('../controllers/publicTaskInviteController');
const { postAccessEvent } = require('../controllers/accessAnalyticsController');
const { postMarketplaceAiSearch } = require('../controllers/marketplaceAiSearchController');
const { getPublicInstructorProfile } = require('../controllers/publicInstructorProfileController');
const { getInstructorMessagingLink } = require('../controllers/publicInstructorContactController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/join/:code', getPublicJoin);
router.get('/exam-invite/:examId', getPublicExamInvite);
router.post('/exam-invite/:examId/join', postPublicExamGuestJoin);
router.get('/task-invite/:taskId', getPublicTaskInvite);
router.post('/task-invite/:taskId/join', postPublicTaskGuestJoin);

router.post('/analytics/event', postAccessEvent);
router.get('/landing-stats', getLandingStats);
router.get('/marketing/login', getPublicLoginMarketing);
router.get('/instructors-map', getInstructorsInMapView);
router.get('/instructors/:id', getPublicInstructorProfile);
router.get('/instructors/:id/messaging', authenticate, getInstructorMessagingLink);
router.get('/instructor-discovery', getInstructorDiscovery);
router.get('/categories', getCategoriesTree);
router.get('/categories/popular', getPopularCategories);
router.get('/categories/search', getCategoriesSearch);
router.get('/categories/:slug', getCategoryBySlugHandler);
router.get('/service-areas', getServiceAreas);
router.post('/inquiries', postPublicInquiry);
router.post('/marketplace/ai-search', postMarketplaceAiSearch);
router.get('/subscription-plans', async (_req, res) => {
  try {
    const list = await getActivePlansList();
    const plans = list.map((p) => ({
      id: p.slug,
      title: p.title,
      price_azn: p.price_azn,
      highlight: p.highlight,
      items: Array.isArray(p.features) ? p.features : null,
      limits: p.limits,
    }));
    res.json({ success: true, plans });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;
