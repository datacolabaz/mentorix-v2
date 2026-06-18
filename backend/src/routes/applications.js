const express = require('express');
const { authenticate } = require('../middleware/auth');
const {
  postApplication,
  getMyApplications,
} = require('../controllers/universityApplicationsController');

const router = express.Router();

router.post('/', authenticate, postApplication);
router.get('/mine', authenticate, getMyApplications);

module.exports = router;
