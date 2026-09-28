const {
  listFeatureFlags,
  setFeatureFlag,
  listFeatureFlagAudit,
} = require('../services/featureFlagService');
const { clientIp } = require('../utils/clientIp');

const getAdminFeatureFlags = async (_req, res) => {
  try {
    const flags = await listFeatureFlags();
    res.json({ success: true, flags });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
};

const patchAdminFeatureFlag = async (req, res) => {
  try {
    const key = String(req.params.key || '').trim();
    const enabled = req.body?.enabled;
    const flag = await setFeatureFlag(key, enabled, {
      actorId: req.user.id,
      ip: clientIp(req),
      userAgent: req.headers['user-agent'] || null,
    });
    res.json({ success: true, flag });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message || 'Xəta' });
  }
};

const getAdminFeatureFlagAudit = async (req, res) => {
  try {
    const audit = await listFeatureFlagAudit({ limit: req.query.limit });
    res.json({ success: true, audit });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
};

module.exports = { getAdminFeatureFlags, patchAdminFeatureFlag, getAdminFeatureFlagAudit };
