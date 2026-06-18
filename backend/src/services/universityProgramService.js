const db = require('../utils/db');
const {
  buildProgramsSearchCacheKey,
  cacheGet,
  cacheSet,
} = require('./universityProgramCache');
const { fieldMeta, fieldSearchTerms, relatedFieldSlugs } = require('../constants/universityFieldCatalog');
const { buildMockSearchResponse } = require('../constants/universityMockPrograms');

const MVP_COUNTRIES = ['Almaniya', 'Polşa', 'Türkiyə', 'Macarıstan', 'İtaliya'];
const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;

function parseBool(v) {
  if (v === true || v === 'true' || v === '1') return true;
  if (v === false || v === 'false' || v === '0') return false;
  return null;
}

function parseNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseArray(v) {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === 'string' && v.trim()) {
    return v.split(',').map((x) => x.trim()).filter(Boolean);
  }
  return [];
}

function normalizeFilters(query = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(query.limit, 10) || DEFAULT_LIMIT));
  const offset = (page - 1) * limit;

  const countries = parseArray(query.countries || query.country);
  const degreeLevel = query.degree_level ? String(query.degree_level).trim() : null;
  const field = query.field ? String(query.field).trim() : null;
  const scholarship = parseBool(query.scholarship);
  const maxTuition = parseNumber(query.max_tuition);
  const minGpa = parseNumber(query.min_gpa);
  const language = query.language ? String(query.language).trim() : null;
  const deadlineBefore = query.deadline_before ? String(query.deadline_before).trim() : null;
  const sort = ['ranking', 'tuition_asc', 'tuition_desc', 'deadline'].includes(query.sort)
    ? query.sort
    : 'ranking';
  const q = query.q ? String(query.q).trim().slice(0, 120) : null;

  return {
    page,
    limit,
    offset,
    countries,
    degreeLevel,
    field,
    scholarship,
    maxTuition,
    minGpa,
    language,
    deadlineBefore,
    sort,
    q,
  };
}

function buildOrderBy(sort) {
  switch (sort) {
    case 'tuition_asc':
      return 'p.tuition_fee ASC NULLS LAST, u.world_ranking ASC NULLS LAST';
    case 'tuition_desc':
      return 'p.tuition_fee DESC NULLS LAST, u.world_ranking ASC NULLS LAST';
    case 'deadline':
      return 'next_deadline ASC NULLS LAST, u.world_ranking ASC NULLS LAST';
    case 'ranking':
    default:
      return 'u.world_ranking ASC NULLS LAST, p.tuition_fee ASC NULLS LAST';
  }
}

function mapProgramRow(row) {
  return {
    id: row.id,
    degree_level: row.degree_level,
    name: row.name,
    field: row.field,
    duration_years: row.duration_years != null ? Number(row.duration_years) : null,
    tuition_fee: row.tuition_fee != null ? Number(row.tuition_fee) : null,
    scholarship_available: Boolean(row.scholarship_available),
    language: row.language,
    intake_months: row.intake_months || [],
    deadline_dates: (row.deadline_dates || []).map((d) =>
      d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10),
    ),
    next_deadline: row.next_deadline
      ? row.next_deadline instanceof Date
        ? row.next_deadline.toISOString().slice(0, 10)
        : String(row.next_deadline).slice(0, 10)
      : null,
    requirements: row.requirements || {},
    apply_link: row.apply_link,
    portal_source: row.portal_source,
    source_type: row.source_type || 'seed',
    mentor: row.contributor_user_id
      ? {
          user_id: row.contributor_user_id,
          display_name: row.mentor_display_name || 'Mentor',
        }
      : null,
    university: {
      id: row.uni_id,
      name: row.uni_name,
      country: row.uni_country,
      city: row.uni_city,
      world_ranking: row.world_ranking != null ? Number(row.world_ranking) : null,
      logo_url: row.logo_url,
      housing_info: row.housing_info,
      funding_info: row.funding_info,
    },
  };
}

function formatSearchResult(programs, filters, { source = 'database', total, cached = false, fallback = false } = {}) {
  const count = total != null ? total : programs.length;
  return {
    success: true,
    count,
    data: programs,
    programs,
    source,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total: count,
      total_pages: Math.max(1, Math.ceil(count / filters.limit)),
    },
    filters,
    meta: {
      mvp_countries: MVP_COUNTRIES,
      fallback: Boolean(fallback),
    },
    cached: Boolean(cached),
  };
}

function appendFieldFilter(where, params, fieldSlug) {
  if (!fieldSlug) return;
  const slugs = relatedFieldSlugs(fieldSlug);
  const terms = fieldSearchTerms(fieldSlug);
  const patterns = terms.map((t) => `%${t}%`);

  params.push(slugs);
  const slugsIdx = params.length;
  params.push(fieldSlug);
  const slugIdx = params.length;
  params.push(patterns);
  const patIdx = params.length;

  where.push(`(
    p.field = ANY($${slugsIdx}::text[])
    OR p.field = $${slugIdx}
    OR EXISTS (
      SELECT 1 FROM unnest($${patIdx}::text[]) pat
      WHERE p.name ILIKE pat OR p.field ILIKE pat
    )
  )`);
}

async function queryProgramsFromDatabase(filters) {
  const params = [];
  const where = [
    'p.is_active = true',
    'u.is_active = true',
    "(p.review_status = 'approved' OR p.source_type = 'seed')",
  ];

  if (filters.degreeLevel) {
    params.push(filters.degreeLevel);
    where.push(`p.degree_level = $${params.length}`);
  }
  appendFieldFilter(where, params, filters.field);
  if (filters.countries.length) {
    params.push(filters.countries);
    where.push(`u.country = ANY($${params.length}::text[])`);
  }
  if (filters.scholarship === true) {
    where.push('p.scholarship_available = true');
  }
  if (filters.maxTuition != null) {
    params.push(filters.maxTuition);
    where.push(`(p.tuition_fee IS NULL OR p.tuition_fee <= $${params.length})`);
  }
  if (filters.minGpa != null) {
    params.push(filters.minGpa);
    where.push(`COALESCE((p.requirements->>'min_gpa')::numeric, 0) <= $${params.length}`);
  }
  if (filters.language) {
    params.push(filters.language);
    where.push(`p.language ILIKE $${params.length}`);
  }
  if (filters.deadlineBefore) {
    params.push(filters.deadlineBefore);
    where.push(
      `EXISTS (SELECT 1 FROM unnest(p.deadline_dates) d WHERE d <= $${params.length}::date AND d >= CURRENT_DATE)`,
    );
  }
  if (filters.q) {
    params.push(`%${filters.q}%`);
    const idx = params.length;
    where.push(`(p.name ILIKE $${idx} OR u.name ILIKE $${idx} OR p.field ILIKE $${idx})`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const orderBy = buildOrderBy(filters.sort);

  const countSql = `
    SELECT COUNT(*)::int AS total
    FROM programs p
    INNER JOIN universities u ON u.id = p.uni_id
    ${whereSql}
  `;
  const { rows: countRows } = await db.query(countSql, params);
  const total = countRows[0]?.total || 0;

  params.push(filters.limit);
  const limitIdx = params.length;
  params.push(filters.offset);
  const offsetIdx = params.length;

  const dataSql = `
    SELECT
      p.id,
      p.uni_id,
      p.degree_level,
      p.name,
      p.field,
      p.duration_years,
      p.tuition_fee,
      p.scholarship_available,
      p.language,
      p.intake_months,
      p.deadline_dates,
      p.requirements,
      p.apply_link,
      p.portal_source,
      p.source_type,
      p.contributor_user_id,
      p.mentor_display_name,
      u.name AS uni_name,
      u.country AS uni_country,
      u.city AS uni_city,
      u.world_ranking,
      u.logo_url,
      u.housing_info,
      u.funding_info,
      (
        SELECT MIN(d)
        FROM unnest(p.deadline_dates) d
        WHERE d >= CURRENT_DATE
      ) AS next_deadline
    FROM programs p
    INNER JOIN universities u ON u.id = p.uni_id
    ${whereSql}
    ORDER BY ${orderBy}
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;

  const { rows } = await db.query(dataSql, params);
  return { programs: rows.map(mapProgramRow), total };
}

async function searchPrograms(rawQuery = {}) {
  const filters = normalizeFilters(rawQuery);
  const cacheKey = buildProgramsSearchCacheKey(filters);
  const cached = await cacheGet(cacheKey);
  if (cached) {
    return {
      ...cached,
      data: cached.data || cached.programs || [],
      count: cached.count != null ? cached.count : (cached.programs || []).length,
      cached: true,
    };
  }

  try {
    const { programs, total } = await queryProgramsFromDatabase(filters);
    if (total > 0) {
      const result = formatSearchResult(programs, filters, { source: 'database', total });
      await cacheSet(cacheKey, result);
      return result;
    }
    console.warn('[programs] database empty for filters, using mock fallback');
  } catch (err) {
    console.error('[programs] database search failed, using mock fallback:', err?.message || err);
  }

  const mockResult = buildMockSearchResponse(filters);
  await cacheSet(cacheKey, mockResult);
  return mockResult;
}

async function getProgramById(programId) {
  try {
    const { rows } = await db.query(
    `
    SELECT
      p.id,
      p.uni_id,
      p.degree_level,
      p.name,
      p.field,
      p.duration_years,
      p.tuition_fee,
      p.scholarship_available,
      p.language,
      p.intake_months,
      p.deadline_dates,
      p.requirements,
      p.apply_link,
      p.portal_source,
      p.source_type,
      p.contributor_user_id,
      p.mentor_display_name,
      u.name AS uni_name,
      u.country AS uni_country,
      u.city AS uni_city,
      u.world_ranking,
      u.logo_url,
      u.housing_info,
      u.funding_info,
      (
        SELECT MIN(d)
        FROM unnest(p.deadline_dates) d
        WHERE d >= CURRENT_DATE
      ) AS next_deadline
    FROM programs p
    INNER JOIN universities u ON u.id = p.uni_id
    WHERE p.id = $1 AND p.is_active = true AND u.is_active = true
    LIMIT 1
    `,
    [programId],
    );
    if (rows.length) return mapProgramRow(rows[0]);
  } catch (err) {
    console.error('[programs] getProgramById db failed:', err?.message || err);
  }

  const { MOCK_PROGRAMS } = require('../constants/universityMockPrograms');
  return MOCK_PROGRAMS.find((p) => p.id === programId) || null;
}

async function upsertApplicantProfile(userId, payload = {}) {
  const {
    full_name,
    nationality,
    current_degree,
    gpa,
    language_scores,
    work_exp,
    research_exp,
    budget_range,
    preferred_countries,
  } = payload;

  const { rows } = await db.query(
    `
    INSERT INTO university_applicant_profiles (
      user_id, full_name, nationality, current_degree, gpa,
      language_scores, work_exp, research_exp, budget_range, preferred_countries, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10::text[], NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      full_name = COALESCE(EXCLUDED.full_name, university_applicant_profiles.full_name),
      nationality = COALESCE(EXCLUDED.nationality, university_applicant_profiles.nationality),
      current_degree = COALESCE(EXCLUDED.current_degree, university_applicant_profiles.current_degree),
      gpa = COALESCE(EXCLUDED.gpa, university_applicant_profiles.gpa),
      language_scores = COALESCE(EXCLUDED.language_scores, university_applicant_profiles.language_scores),
      work_exp = COALESCE(EXCLUDED.work_exp, university_applicant_profiles.work_exp),
      research_exp = COALESCE(EXCLUDED.research_exp, university_applicant_profiles.research_exp),
      budget_range = COALESCE(EXCLUDED.budget_range, university_applicant_profiles.budget_range),
      preferred_countries = COALESCE(EXCLUDED.preferred_countries, university_applicant_profiles.preferred_countries),
      updated_at = NOW()
    RETURNING *
    `,
    [
      userId,
      full_name || null,
      nationality || null,
      current_degree || null,
      gpa != null ? Number(gpa) : null,
      JSON.stringify(language_scores || {}),
      work_exp || null,
      research_exp || null,
      budget_range || null,
      Array.isArray(preferred_countries) ? preferred_countries : [],
    ],
  );
  return rows[0];
}

async function saveSearch(userId, filtersJson, recommendationsJson = []) {
  const { rows } = await db.query(
    `
    INSERT INTO university_saved_searches (user_id, filters_json, recommendations_json)
    VALUES ($1, $2::jsonb, $3::jsonb)
    RETURNING *
    `,
    [userId, JSON.stringify(filtersJson || {}), JSON.stringify(recommendationsJson || [])],
  );
  return rows[0];
}

module.exports = {
  MVP_COUNTRIES,
  FIELD_GROUPS,
  flatFieldOptions,
  normalizeFilters,
  searchPrograms,
  getProgramById,
  upsertApplicantProfile,
  saveSearch,
};
