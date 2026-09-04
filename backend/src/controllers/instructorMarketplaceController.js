const { getLatestMarketplaceOpportunity } = require('../services/marketplaceSearchOpportunityService');
const { mapFeatureLineForPlan } = require('../services/mapListingPlanService');
const { resolveEntitlements } = require('../services/billingEntitlements');
const { localeFromReq } = require('../lib/userLocale');

const getMarketplaceOpportunity = async (req, res) => {
  try {
    const locale = localeFromReq(req);
    const data = await getLatestMarketplaceOpportunity(req.user.id, locale);
    const ent = await resolveEntitlements(req.user.id, { locale }).catch(() => null);
    const plan = ent?.plan || data.plan || 'basic';
    res.json({
      success: true,
      plan,
      map_feature: mapFeatureLineForPlan(plan, locale),
      ...data,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
};

module.exports = { getMarketplaceOpportunity };
