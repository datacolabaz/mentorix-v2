const express = require('express');
const { getLandingStats } = require('../controllers/publicLandingController');

const router = express.Router();

router.get('/landing-stats', getLandingStats);

module.exports = router;
