const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { generationRateLimit } = require('../middleware/generationRateLimit');

const router = express.Router();

router.use(authenticate);
router.use(authorize('instructor'));
router.use(generationRateLimit);

// BE-08+: generation handlers mount on this router.

module.exports = router;
