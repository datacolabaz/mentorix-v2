const router = require('express').Router();

/**
 * SMS is retired. The old SMS history/plan/pack-catchup endpoints answer 410; the sms_logs rows are kept
 * (deprecated, migration 228) and will be exported/dropped per the later-drop plan.
 */
router.use((_req, res) =>
  res.status(410).json({
    success: false,
    code: 'SMS_RETIRED',
    message: 'SMS bildirişləri dayandırılıb. Bildirişlər e-poçt və platforma daxilində göndərilir.',
  }),
);

module.exports = router;
