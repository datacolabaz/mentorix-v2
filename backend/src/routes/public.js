const express = require('express');
const { getLandingStats } = require('../controllers/publicLandingController');
const { getPublicLoginMarketing } = require('../controllers/siteMarketingController');
const { getInstructorsInMapView } = require('../controllers/publicInstructorMapController');
const { getActivePlansList } = require('../services/subscriptionPlansService');
const { getPublicJoin } = require('../controllers/joinInvitationController');

const router = express.Router();

router.get('/join/:code', getPublicJoin);

router.get('/landing-stats', getLandingStats);
router.get('/marketing/login', getPublicLoginMarketing);
router.get('/instructors-map', getInstructorsInMapView);
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
