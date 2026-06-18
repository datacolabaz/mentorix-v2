const db = require('../utils/db');
const { fieldMeta } = require('../constants/universityFieldCatalog');

function slugifyUni(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

async function upsertUniversity({ name, country, city, world_ranking, logo_url, housing_info, funding_info }) {
  const slug = slugifyUni(name);
  const { rows } = await db.query(
    `
    INSERT INTO universities (name, country, city, world_ranking, logo_url, housing_info, funding_info, slug, is_active)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
    ON CONFLICT (slug) DO UPDATE SET
      name = EXCLUDED.name,
      country = COALESCE(EXCLUDED.country, universities.country),
      city = COALESCE(EXCLUDED.city, universities.city),
      world_ranking = COALESCE(EXCLUDED.world_ranking, universities.world_ranking),
      housing_info = COALESCE(EXCLUDED.housing_info, universities.housing_info),
      funding_info = COALESCE(EXCLUDED.funding_info, universities.funding_info),
      is_active = true
    RETURNING *
    `,
    [
      name,
      country,
      city || null,
      world_ranking != null ? Number(world_ranking) : null,
      logo_url || null,
      housing_info || null,
      funding_info || null,
      slug,
    ],
  );
  return rows[0];
}

function normalizeDegree(level) {
  const v = String(level || '').trim();
  if (['BSc', 'MSc', 'PhD'].includes(v)) return v;
  const lower = v.toLowerCase();
  if (lower.includes('bachelor') || lower.includes('bsc')) return 'BSc';
  if (lower.includes('master') || lower.includes('msc') || lower.includes('mba')) return 'MSc';
  if (lower.includes('phd') || lower.includes('doctor')) return 'PhD';
  return 'MSc';
}

function normalizeFieldSlug(raw, hint) {
  const v = String(raw || hint || '').trim();
  if (fieldMeta(v)) return v;
  const lower = v.toLowerCase();
  if (lower.includes('computer') || lower.includes('informatics')) return 'computer_science';
  if (lower.includes('data')) return 'data_science';
  if (lower.includes('business') || lower.includes('management')) return 'business_administration';
  if (lower.includes('finance')) return 'finance';
  if (lower.includes('electrical')) return 'electrical_engineering';
  if (lower.includes('mechanical')) return 'mechanical_engineering';
  if (lower.includes('biology') || lower.includes('life')) return 'biology';
  return hint || 'computer_science';
}

async function upsertProgram({
  uni_id,
  payload,
  source_type = 'scraper',
  review_status = 'pending',
  contributor_user_id = null,
  mentor_display_name = null,
  scrape_url = null,
  ai_raw_json = {},
}) {
  const name = String(payload.name || '').trim();
  if (!name || !uni_id) return null;

  const degree_level = normalizeDegree(payload.degree_level);
  const field = normalizeFieldSlug(payload.field, payload.field_hint);
  const tuition_fee = payload.tuition_fee_eur != null ? Number(payload.tuition_fee_eur) : payload.tuition_fee != null ? Number(payload.tuition_fee) : null;
  const deadline_dates = Array.isArray(payload.deadline_dates) ? payload.deadline_dates.filter(Boolean) : [];
  const requirements = payload.requirements && typeof payload.requirements === 'object' ? payload.requirements : {};

  const { rows } = await db.query(
    `
    INSERT INTO programs (
      uni_id, degree_level, name, field, duration_years, tuition_fee,
      scholarship_available, language, intake_months, deadline_dates, requirements,
      apply_link, portal_source, source_type, review_status, contributor_user_id,
      mentor_display_name, scrape_url, ai_extracted_at, ai_raw_json, is_active, updated_at
    )
    VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9, $10::date[], $11::jsonb,
      $12, $13, $14, $15, $16,
      $17, $18, NOW(), $19::jsonb, $20, NOW()
    )
    ON CONFLICT (uni_id, name, degree_level) DO UPDATE SET
      field = EXCLUDED.field,
      duration_years = COALESCE(EXCLUDED.duration_years, programs.duration_years),
      tuition_fee = COALESCE(EXCLUDED.tuition_fee, programs.tuition_fee),
      scholarship_available = COALESCE(EXCLUDED.scholarship_available, programs.scholarship_available),
      language = COALESCE(EXCLUDED.language, programs.language),
      deadline_dates = CASE WHEN cardinality(EXCLUDED.deadline_dates) > 0 THEN EXCLUDED.deadline_dates ELSE programs.deadline_dates END,
      requirements = COALESCE(EXCLUDED.requirements, programs.requirements),
      apply_link = COALESCE(EXCLUDED.apply_link, programs.apply_link),
      scrape_url = COALESCE(EXCLUDED.scrape_url, programs.scrape_url),
      ai_extracted_at = NOW(),
      ai_raw_json = COALESCE(EXCLUDED.ai_raw_json, programs.ai_raw_json),
      updated_at = NOW()
    RETURNING *
    `,
    [
      uni_id,
      degree_level,
      name,
      field,
      payload.duration_years != null ? Number(payload.duration_years) : null,
      Number.isFinite(tuition_fee) ? tuition_fee : null,
      Boolean(payload.scholarship_available),
      payload.language || 'English',
      Array.isArray(payload.intake_months) ? payload.intake_months : [],
      deadline_dates,
      JSON.stringify(requirements),
      payload.apply_link || scrape_url || null,
      source_type === 'mentor' ? 'mentor' : 'ai-scraper',
      source_type,
      review_status,
      contributor_user_id,
      mentor_display_name,
      scrape_url,
      JSON.stringify(ai_raw_json || {}),
      review_status === 'approved',
    ],
  );

  if (rows.length) return rows[0];
  return null;
}

module.exports = {
  upsertUniversity,
  upsertProgram,
  normalizeDegree,
  normalizeFieldSlug,
};
