const { getLatestMarketplaceOpportunity } = require('../services/marketplaceSearchOpportunityService');
const { mapFeatureLineForPlan } = require('../services/mapListingPlanService');
const { resolveEntitlements } = require('../services/billingEntitlements');

const getMarketplaceOpportunity = async (req, res) => {
  try {
    const data = await getLatestMarketplaceOpportunity(req.user.id);
    const ent = await resolveEntitlements(req.user.id).catch(() => null);
    const plan = ent?.plan || data.plan || 'basic';
    res.json({
      success: true,
      plan,
      map_feature: mapFeatureLineForPlan(plan),
      ...data,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
};

module.exports = { getMarketplaceOpportunity };
