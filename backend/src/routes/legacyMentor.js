/**
 * LEGACY /api/mentor/* (internal path, never shown to users).
 * - onboarding / ask: aliases of /api/assistant for browser tabs still running the previous bundle.
 * - everything else was the retired mentorship workspace: 410 Gone. Its tables are kept as legacy data.
 */
const express = require('express');
const assistantRoutes = require('./assistant');

const router = express.Router();

const RETIRED_BODY = Object.freeze({
  success: false,
  code: 'FEATURE_RETIRED',
  message: 'Bu funksiya artıq mövcud deyil',
});

router.use((req, res, next) => {
  const path = String(req.path || '').replace(/\/+$/, '');
  if (path === '/onboarding' || path === '/ask') return assistantRoutes(req, res, next);
  return res.status(410).json(RETIRED_BODY);
});

module.exports = router;
module.exports.RETIRED_BODY = RETIRED_BODY;
