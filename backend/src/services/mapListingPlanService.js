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

/** İctimai axtarış/xəritə siyahısı üçün əlavə sahələr */
const PUBLIC_DISCOVER_LISTING_SQL = `
  ip.discover_hourly_rate,
  ip.discover_verified,
  (
    SELECT COALESCE(json_agg(c.name_az ORDER BY c.name_az), '[]'::json)
    FROM instructor_categories ic
    INNER JOIN categories c ON c.id = ic.category_id
    WHERE ic.user_id = u.id
    LIMIT 5
  ) AS category_names`;

function normalizeCategoryNames(raw) {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  return [];
}

function enrichInstructorListingRow(row) {
  const plan = normalizePlanSlug(row?.plan);
  const rank = planRank(plan);
  const category_names = normalizeCategoryNames(row?.category_names);
  const subjectTrim = String(row?.subject || '').trim();
  const display_subject =
    category_names.length > 0
      ? category_names.join(', ')
      : subjectTrim && subjectTrim !== '—'
        ? subjectTrim
        : null;
  return {
    ...row,
    plan,
    category_names,
    display_subject,
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
  PUBLIC_DISCOVER_LISTING_SQL,
  normalizeCategoryNames,
  enrichInstructorListingRow,
  mapFeatureLineForPlan,
  shouldReceiveSearchOpportunityAlerts,
  MAP_FEATURE_BY_PLAN,
};
