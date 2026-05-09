const db = require('../utils/db');
const { normalizePlanSlug } = require('../config/plans');

// Lightweight cache to avoid DB hit on every request, but still "dynamic".
// TTL is short so admin edits reflect quickly.
const CACHE_TTL_MS = 5000;
let cache = { at: 0, plans: null };

function now() {
  return Date.now();
}

function gbToMb(gb) {
  if (gb == null) return null;
  const n = Number(gb);
  if (!Number.isFinite(n)) return null;
  // Ceil avoids sub‑MB GB fractions collapsing to 0 MB (free tier fractions).
  return Math.max(0, Math.ceil(n * 1024));
}

function normalizeRow(r) {
  const slug = normalizePlanSlug(r.slug);
  const price_azn = Number(r.price_azn || 0) || 0;
  const students = r.student_limit == null ? null : Number(r.student_limit);
  const storage_mb = gbToMb(r.storage_gb);
  const sms_monthly = r.sms_limit == null ? null : Number(r.sms_limit);
  const ram_limit_mb = r.ram_limit_mb == null ? null : Number(r.ram_limit_mb);
  const features = Array.isArray(r.features) ? r.features : r.features ? r.features : null;
  return {
    slug,
    title: String(r.title || slug).trim() || slug.toUpperCase(),
    price_azn,
    limits: { students, storage_mb, sms_monthly, ram_limit_mb },
    highlight: Boolean(r.highlight),
    is_active: Boolean(r.is_active),
    features,
    updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : null,
  };
}

async function loadPlansFromDb() {
  const { rows } = await db.query(
    `SELECT slug, title, price_azn, student_limit, storage_gb, sms_limit, ram_limit_mb, features, highlight, is_active, updated_at
     FROM subscription_plans
     WHERE is_active = TRUE
     ORDER BY CASE slug WHEN 'basic' THEN 1 WHEN 'pro' THEN 2 WHEN 'business' THEN 3 ELSE 99 END, slug`
  );
  const out = (rows || []).map(normalizeRow);
  return out;
}

async function getActivePlansList({ forceRefresh = false } = {}) {
  const fresh = cache.plans && now() - cache.at < CACHE_TTL_MS;
  if (!forceRefresh && fresh) return cache.plans;
  const plans = await loadPlansFromDb();
  cache = { at: now(), plans };
  return plans;
}

async function getActivePlansMap() {
  const list = await getActivePlansList();
  const map = {};
  for (const p of list) map[p.slug] = p;
  return map;
}

async function getPlanOrThrow(slugRaw) {
  const slug = normalizePlanSlug(slugRaw);
  const map = await getActivePlansMap();
  const p = map[slug];
  if (!p) {
    const err = new Error('PLAN_INVALID');
    err.code = 'PLAN_INVALID';
    err.statusCode = 400;
    err.status = 400;
    throw err;
  }
  return p;
}

async function adminListPlans() {
  const { rows } = await db.query(
    `SELECT slug, title, price_azn, student_limit, storage_gb, sms_limit, ram_limit_mb, features, highlight, is_active, updated_at
     FROM subscription_plans
     ORDER BY CASE slug WHEN 'basic' THEN 1 WHEN 'pro' THEN 2 WHEN 'business' THEN 3 ELSE 99 END, slug`
  );
  return (rows || []).map((r) => ({
    slug: String(r.slug),
    title: String(r.title || ''),
    price_azn: Number(r.price_azn || 0) || 0,
    student_limit: r.student_limit == null ? null : Number(r.student_limit),
    storage_gb: r.storage_gb == null ? null : Number(r.storage_gb),
    sms_limit: r.sms_limit == null ? null : Number(r.sms_limit),
    ram_limit_mb: r.ram_limit_mb == null ? null : Number(r.ram_limit_mb),
    features: r.features ?? null,
    highlight: Boolean(r.highlight),
    is_active: Boolean(r.is_active),
    updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : null,
  }));
}

async function adminUpsertPlan(payload) {
  const slug = normalizePlanSlug(payload?.slug);
  const title = String(payload?.title || slug.toUpperCase()).trim();
  const price_azn = Number(payload?.price_azn || 0) || 0;

  const student_limit = payload?.student_limit === '' ? null : payload?.student_limit;
  const storage_gb = payload?.storage_gb === '' ? null : payload?.storage_gb;
  const sms_limit = payload?.sms_limit === '' ? null : payload?.sms_limit;
  const ram_limit_mb = payload?.ram_limit_mb === '' ? null : payload?.ram_limit_mb;
  const highlight = Boolean(payload?.highlight);
  const is_active = payload?.is_active !== false;

  // features can be array or stringified JSON or comma-lines; store as JSON array when possible.
  let features = payload?.features ?? null;
  if (typeof features === 'string') {
    const s = features.trim();
    if (!s) features = null;
    else {
      try {
        const parsed = JSON.parse(s);
        features = parsed;
      } catch {
        features = s.split('\n').map((x) => x.trim()).filter(Boolean);
      }
    }
  }

  await db.query(
    `INSERT INTO subscription_plans (slug, title, price_azn, student_limit, storage_gb, sms_limit, ram_limit_mb, features, highlight, is_active, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,NOW())
     ON CONFLICT (slug) DO UPDATE SET
       title=EXCLUDED.title,
       price_azn=EXCLUDED.price_azn,
       student_limit=EXCLUDED.student_limit,
       storage_gb=EXCLUDED.storage_gb,
       sms_limit=EXCLUDED.sms_limit,
       ram_limit_mb=EXCLUDED.ram_limit_mb,
       features=EXCLUDED.features,
       highlight=EXCLUDED.highlight,
       is_active=EXCLUDED.is_active,
       updated_at=NOW()`,
    [
      slug,
      title,
      price_azn,
      student_limit == null ? null : Number(student_limit),
      storage_gb == null ? null : Number(storage_gb),
      sms_limit == null ? null : Number(sms_limit),
      ram_limit_mb == null ? null : Number(ram_limit_mb),
      features ? JSON.stringify(features) : null,
      highlight,
      is_active,
    ]
  );
  cache = { at: 0, plans: null };
}

module.exports = {
  getActivePlansList,
  getActivePlansMap,
  getPlanOrThrow,
  adminListPlans,
  adminUpsertPlan,
};

