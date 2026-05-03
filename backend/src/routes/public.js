const express = require('express');
const { getLandingStats } = require('../controllers/publicLandingController');
const { getPublicLoginMarketing } = require('../controllers/siteMarketingController');

const router = express.Router();

router.get('/landing-stats', getLandingStats);
router.get('/marketing/login', getPublicLoginMarketing);

module.exports = router;
