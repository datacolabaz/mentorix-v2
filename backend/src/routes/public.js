const express = require('express');
const { getLandingStats } = require('../controllers/publicLandingController');
const { getPublicLoginMarketing } = require('../controllers/siteMarketingController');
const { getPublicInstructorNav } = require('../controllers/instructorNavController');
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
const { getPublicLibraryInvite, postPublicLibraryGuestJoin } = require('../controllers/publicLibraryInviteController');
const { getPublicMaterialInvite, postPublicMaterialGuestJoin } = require('../controllers/publicMaterialInviteController');
const { getPublicMaterialPreview, servePublicMaterialPreviewFile } = require('../controllers/publicMaterialPreviewController');
const { getPublicRecording, getPublicRecordingInfo } = require('../controllers/liveRoomController');
const {
  getPublicLiveGuestInvite,
  postPublicLiveGuestJoin,
  postPublicLiveGuestLeave,
} = require('../controllers/publicLiveGuestController');
const { publicGuestJoinRateLimit } = require('../middleware/publicGuestJoinRateLimit');
const { postAccessEvent } = require('../controllers/accessAnalyticsController');
const { postMarketplaceAiSearch } = require('../controllers/marketplaceAiSearchController');
const { getPublicContact } = require('../controllers/platformContactController');
const { getPublicInstructorProfile } = require('../controllers/publicInstructorProfileController');
const { getInstructorMessagingLink } = require('../controllers/publicInstructorContactController');
const {
  listPublicCertifiedExams,
  getPublicCertifiedExamStats,
  listParentCategories,
  listAllCatalogCategories,
  getCategoryBySlug,
  getCareerPathBySlug,
  getUserSkillProgress,
  getCertifiedExamBySlug,
} = require('../controllers/publicCertifiedExamsController');
const { getPublicSitemapXml } = require('../controllers/publicSitemapController');
const { postPublicWaitlist } = require('../controllers/waitlistController');
const { getCertifiedCategoryOg, getExamOg, getCertifiedExamOg, getTaskOg, getMaterialOg } = require('../controllers/publicOgController');
const { authenticate, optionalAuthenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/join/:code', getPublicJoin);
router.get('/exam-invite/:examId', getPublicExamInvite);
router.post('/exam-invite/:examId/join', postPublicExamGuestJoin);
router.get('/task-invite/:taskId', getPublicTaskInvite);
router.post('/task-invite/:taskId/join', postPublicTaskGuestJoin);
router.get('/library-invite/:groupId', getPublicLibraryInvite);
router.post('/library-invite/:groupId/join', postPublicLibraryGuestJoin);
router.get('/material-invite/:materialId', getPublicMaterialInvite);
router.post('/material-invite/:materialId/join', postPublicMaterialGuestJoin);
router.get('/material-preview/:token', getPublicMaterialPreview);
router.get('/material-preview/:token/file', servePublicMaterialPreviewFile);
router.get('/live-recording/:shareToken/info', getPublicRecordingInfo);
router.get('/live-recording/:shareToken', getPublicRecording);
router.get('/live-guest/:token', getPublicLiveGuestInvite);
router.post('/live-guest/:token/join', publicGuestJoinRateLimit, postPublicLiveGuestJoin);
router.post('/live-guest/:token/leave', postPublicLiveGuestLeave);

router.post('/analytics/event', postAccessEvent);
router.get('/landing-stats', getLandingStats);
router.get('/contact', getPublicContact);
router.get('/og/certified-category/:slug', getCertifiedCategoryOg);
router.get('/og/certified-exam/:categorySlug/:examSlug', getCertifiedExamOg);
router.get('/og/exam/:examId', getExamOg);
router.get('/og/task/:taskId', getTaskOg);
router.get('/og/material/:materialId', getMaterialOg);
router.get('/certified-exams/categories/all', listAllCatalogCategories);
router.get('/certified-exams/categories', listParentCategories);
router.get('/certified-exams/categories/:slug', getCategoryBySlug);
router.get('/certified-exams/:categorySlug/:examSlug', getCertifiedExamBySlug);
router.get('/certified-exams/career-paths/:slug', optionalAuthenticate, getCareerPathBySlug);
router.get('/certified-exams', listPublicCertifiedExams);
router.get('/certified-exams/stats', getPublicCertifiedExamStats);
router.post('/waitlist', postPublicWaitlist);
router.post('/certified-exams/waitlist', postPublicWaitlist);
router.get('/certified-exams/me/skill-progress', authenticate, getUserSkillProgress);
router.get('/sitemap.xml', getPublicSitemapXml);
router.get('/marketing/login', getPublicLoginMarketing);
router.get('/instructor-nav', getPublicInstructorNav);
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
      marketing_features: p.marketing_features,
      plan_subtitle: p.plan_subtitle,
      plan_cta: p.plan_cta,
      popular_label: p.popular_label,
    }));
    res.json({ success: true, plans });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;
