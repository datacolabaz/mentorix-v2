const { normalizePlanSlug, planRank } = require('../config/plans');

/** SQL: premium → growth → pro → basic (ASC = yuxarıda) */
function sqlPlanListingPriority(planColumn = "COALESCE(s.plan, 'basic')") {
  const col = planColumn;
  return `CASE
    WHEN LOWER(TRIM(${col}::text)) IN ('premium', 'business', 'biznes') THEN 1
    WHEN LOWER(TRIM(${col}::text)) = 'growth' THEN 2
    WHEN LOWER(TRIM(${col}::text)) = 'pro' THEN 3
    ELSE 4
  END`;
}

function enrichInstructorListingRow(row) {
  const plan = normalizePlanSlug(row?.plan);
  const rank = planRank(plan);
  return {
    ...row,
    plan,
    listing_priority: 5 - rank,
    is_top_listing: plan === 'premium',
    is_featured_listing: plan === 'growth',
    is_premium_listing: plan === 'premium',
    map_listing_status:
      plan === 'premium'
        ? 'top'
        : plan === 'growth'
          ? 'featured'
          : 'visible',
  };
}

const MAP_FEATURE_BY_PLAN = {
  basic: '📍 Xəritədə görünür',
  pro: '📍 Xəritədə görünür',
  growth: '⭐ Axtarışda önə çıxır',
  premium: '🔥 Axtarışda həmişə ən yuxarıda (TOP)',
};

function mapFeatureLineForPlan(planSlug) {
  return MAP_FEATURE_BY_PLAN[normalizePlanSlug(planSlug)] || MAP_FEATURE_BY_PLAN.basic;
}

function shouldReceiveSearchOpportunityAlerts(planSlug) {
  const p = normalizePlanSlug(planSlug);
  return p === 'basic' || p === 'pro';
}

module.exports = {
  sqlPlanListingPriority,
  enrichInstructorListingRow,
  mapFeatureLineForPlan,
  shouldReceiveSearchOpportunityAlerts,
  MAP_FEATURE_BY_PLAN,
};
