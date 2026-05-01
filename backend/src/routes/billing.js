const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { resolveEntitlements } = require('../services/billingEntitlements');

router.get('/status', authenticate, authorize('instructor'), async (req, res) => {
  try {
    const out = await resolveEntitlements(req.user.id);
    res.json({
      plan: out.plan,
      trial: {
        is_active: out.trial.is_active,
      },
      limits: out.limits,
      usage: out.usage,
      remaining: out.remaining,
      status: out.status,
      should_warn: out.should_warn,
      should_block: out.should_block,
      messages: out.messages,
      timezone: out.timezone,
      requirements: out.requirements,
    });
  } catch (err) {
    res.status(err.statusCode || err.status || 500).json({ success: false, message: err.message, code: err.code });
  }
});

module.exports = router;

