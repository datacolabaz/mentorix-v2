const { isFeatureEnabled } = require('../services/featureFlagService');
const { optionalAuthenticate } = require('./auth');
const { FEATURE_DISABLED_MESSAGE } = require('../constants/featureFlags');

function sendFeatureDisabled(res, key) {
  return res.status(404).json({
    success: false,
    code: 'FEATURE_DISABLED',
    feature: key,
    message: FEATURE_DISABLED_MESSAGE,
  });
}

/**
 * Flag OFF olanda route 404 FEATURE_DISABLED qaytarır.
 * Adminlər söndürülmüş modulu yoxlaya bilsin deyə keçir (yalnız OFF halında token oxunur).
 */
function requireFeature(key, { allowAdmin = true } = {}) {
  return async (req, res, next) => {
    try {
      if (await isFeatureEnabled(key)) return next();
    } catch {
      return sendFeatureDisabled(res, key);
    }
    if (!allowAdmin) return sendFeatureDisabled(res, key);
    if (req.user) {
      return req.user.role === 'admin' ? next() : sendFeatureDisabled(res, key);
    }
    const probe = { headers: req.headers };
    return optionalAuthenticate(probe, res, () =>
      probe.user?.role === 'admin' ? next() : sendFeatureDisabled(res, key),
    );
  };
}

module.exports = { requireFeature, sendFeatureDisabled };
