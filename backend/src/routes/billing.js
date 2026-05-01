const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const db = require('../utils/db');
const { resolveEntitlements, logBillingEvent } = require('../services/billingEntitlements');

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

router.post('/events', authenticate, authorize('instructor'), async (req, res) => {
  try {
    const { event, context } = req.body || {};
    const ev = String(event || '').trim();
    if (!ev) return res.status(400).json({ success: false, message: 'event tələb olunur' });
    await logBillingEvent(db, { user_id: req.user.id, event: ev, context: context || null });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

