const express = require('express');
const { authenticate, optionalAuthenticate } = require('../middleware/auth');
const partnerController = require('../controllers/partnerController');

const router = express.Router();

router.get('/status', optionalAuthenticate, partnerController.getProgramStatus);
router.get('/offer', authenticate, partnerController.myOffer);
router.post('/apply', authenticate, partnerController.apply);
router.get('/me', authenticate, partnerController.me);
router.get('/dashboard', authenticate, partnerController.dashboard);
router.patch('/profile', authenticate, partnerController.updateProfile);
router.post('/links', authenticate, partnerController.createLink);
router.post('/payouts/request', authenticate, partnerController.payoutRequest);

module.exports = router;
