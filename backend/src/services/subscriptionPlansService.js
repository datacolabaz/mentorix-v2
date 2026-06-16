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
  const _rawSb =
    r.storage_limit_bytes == null || r.storage_limit_bytes === '' ? null : Number(r.storage_limit_bytes);
  const storage_limit_bytes = Number.isFinite(_rawSb) ? _rawSb : null;
  const storage_mb =
    storage_limit_bytes != null && Number.isFinite(storage_limit_bytes)
      ? null
      : gbToMb(r.storage_gb);
  const sms_monthly = r.sms_limit == null ? null : Number(r.sms_limit);
  const exams_monthly = r.exam_limit == null ? null : Number(r.exam_limit);
  const homeworks_monthly = r.homework_limit == null ? null : Number(r.homework_limit);
  const documents = r.document_limit == null ? null : Number(r.document_limit);
  const ram_limit_mb = r.ram_limit_mb == null ? null : Number(r.ram_limit_mb);
  const features = Array.isArray(r.features) ? r.features : r.features ? r.features : null;
  return {
    slug,
    title: String(r.title || slug).trim() || slug.toUpperCase(),
    price_azn,
    limits: { students, documents, storage_mb, storage_limit_bytes, sms_monthly, exams_monthly, homeworks_monthly, ram_limit_mb },
    highlight: Boolean(r.highlight),
    is_active: Boolean(r.is_active),
    features,
    updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : null,
  };
}

async function loadPlansFromDb() {
  const { rows } = await db.query(
    `SELECT slug, title, price_azn, student_limit, document_limit, storage_gb, storage_limit_bytes, sms_limit, exam_limit, homework_limit, ram_limit_mb, features, highlight, is_active, updated_at
     FROM subscription_plans
     WHERE is_active = TRUE
     ORDER BY CASE slug WHEN 'basic' THEN 1 WHEN 'pro' THEN 2 WHEN 'growth' THEN 3 WHEN 'premium' THEN 4 WHEN 'business' THEN 4 ELSE 99 END, slug`
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

function storageLabelForBytes(bytes) {
  const b = Number(bytes);
  if (!Number.isFinite(b) || b <= 0) return null;
  if (b === 5 * 1024 * 1024) return '5 MB Sənəd Yaddaşı';
  if (b === 256 * 1024 * 1024) return '256 MB Sənəd Yaddaşı';
  if (b === 1024 * 1024 * 1024) return '1 GB Sənəd Yaddaşı';
  if (b === 2048 * 1024 * 1024) return '2 GB Sənəd Yaddaşı';
  if (b < 1024 * 1024) return `${Math.max(1, Math.round(b / 1024))} KB Sənəd Yaddaşı`;
  const mb = b / (1024 * 1024);
  if (mb >= 1024) {
    const gb = mb / 1024;
    return `${gb % 1 === 0 ? Math.round(gb) : Math.round(gb * 10) / 10} GB Sənəd Yaddaşı`;
  }
  return `${mb >= 10 ? Math.round(mb) : Math.round(mb * 10) / 10} MB Sənəd Yaddaşı`;
}

function formatDocumentCount(n) {
  const v = Math.max(0, Math.round(Number(n) || 0));
  return new Intl.NumberFormat('az-AZ').format(v);
}

/** Admin UI + billing üçün plan xüsusiyyətləri (manual mətn yox). */
function buildPlanFeaturesFromLimits({
  slug,
  student_limit,
  document_limit,
  sms_limit,
  exam_limit,
  homework_limit,
  storage_gb,
  storage_limit_bytes,
}) {
  const lines = [];
  const planSlug = normalizePlanSlug(slug);
  if (student_limit == null) lines.push('Limitsiz tələbə');
  else lines.push(`${Math.max(0, Math.round(Number(student_limit)))} tələbə`);

  if (document_limit == null) {
    if (storage_gb == null && storage_limit_bytes == null) lines.push('Limitsiz sənəd');
    else if (storage_limit_bytes != null && Number.isFinite(Number(storage_limit_bytes))) {
      const label = storageLabelForBytes(storage_limit_bytes);
      lines.push(label || 'Sənəd Yaddaşı');
    } else if (storage_gb != null && Number.isFinite(Number(storage_gb))) {
      const gb = Number(storage_gb);
      lines.push(gb >= 1 ? `${gb} GB Sənəd Yaddaşı` : `${Math.round(gb * 1024)} MB Sənəd Yaddaşı`);
    }
  } else {
    lines.push(`${formatDocumentCount(document_limit)} sənəd`);
  }

  if (sms_limit == null) lines.push('Limitsiz SMS / ay');
  else if (planSlug === 'premium') lines.push('200 SMS / Əlavə balans imkanı');
  else lines.push(`${Math.max(0, Math.round(Number(sms_limit)))} SMS / ay`);

  if (exam_limit == null) lines.push('Limitsiz imtahan / ay');
  else lines.push(`${Math.max(0, Math.round(Number(exam_limit)))} imtahan / ay`);

  if (homework_limit == null) lines.push('Limitsiz tapşırıq / ay');
  else lines.push(`${Math.max(0, Math.round(Number(homework_limit)))} tapşırıq / ay`);
  return lines;
}

function resolveLimitsFromAdminPayload(payload) {
  const usesV2 =
    Object.prototype.hasOwnProperty.call(payload || {}, 'unlimited_students') ||
    Object.prototype.hasOwnProperty.call(payload || {}, 'unlimited_storage') ||
    Object.prototype.hasOwnProperty.call(payload || {}, 'unlimited_sms') ||
    Object.prototype.hasOwnProperty.call(payload || {}, 'unlimited_exams') ||
    Object.prototype.hasOwnProperty.call(payload || {}, 'unlimited_homeworks') ||
    Object.prototype.hasOwnProperty.call(payload || {}, 'unlimited_documents') ||
    Object.prototype.hasOwnProperty.call(payload || {}, 'storage_unit');

  if (!usesV2) return null;

  const student_limit = payload.unlimited_students ? null : Math.max(0, Math.round(Number(payload.student_count ?? 0)));
  const sms_limit = payload.unlimited_sms ? null : Math.max(0, Math.round(Number(payload.sms_count ?? 0)));
  const exam_limit = payload.unlimited_exams ? null : Math.max(0, Math.round(Number(payload.exam_count ?? 0)));
  const homework_limit = payload.unlimited_homeworks
    ? null
    : Math.max(0, Math.round(Number(payload.homework_count ?? 0)));
  const document_limit = payload.unlimited_documents
    ? null
    : Math.max(0, Math.round(Number(payload.document_count ?? 0)));

  let storage_gb = null;
  let storage_limit_bytes = null;
  if (payload.unlimited_storage) {
    storage_gb = null;
    storage_limit_bytes = null;
  } else {
    const unit = String(payload.storage_unit || 'GB')
      .trim()
      .toUpperCase();
    const val = Number(payload.storage_value);
    if (!Number.isFinite(val) || val < 0) {
      storage_gb = null;
      storage_limit_bytes = null;
    } else if (unit === 'MB') {
      storage_gb = null;
      storage_limit_bytes = Math.round(val * 1024 * 1024);
    } else {
      storage_gb = val;
      storage_limit_bytes = null;
    }
  }

  return { student_limit, sms_limit, exam_limit, homework_limit, document_limit, storage_gb, storage_limit_bytes, usesV2: true };
}

async function adminListPlans() {
  const { rows } = await db.query(
    `SELECT slug, title, price_azn, student_limit, document_limit, storage_gb, storage_limit_bytes, sms_limit, exam_limit, homework_limit, ram_limit_mb, features, highlight, is_active, updated_at
     FROM subscription_plans
     ORDER BY CASE slug WHEN 'basic' THEN 1 WHEN 'pro' THEN 2 WHEN 'growth' THEN 3 WHEN 'premium' THEN 4 WHEN 'business' THEN 4 ELSE 99 END, slug`
  );
  return (rows || []).map((r) => ({
    slug: String(r.slug),
    title: String(r.title || ''),
    price_azn: Number(r.price_azn || 0) || 0,
    student_limit: r.student_limit == null ? null : Number(r.student_limit),
    storage_gb: r.storage_gb == null ? null : Number(r.storage_gb),
    storage_limit_bytes: r.storage_limit_bytes == null ? null : Number(r.storage_limit_bytes),
    sms_limit: r.sms_limit == null ? null : Number(r.sms_limit),
    exam_limit: r.exam_limit == null ? null : Number(r.exam_limit),
    homework_limit: r.homework_limit == null ? null : Number(r.homework_limit),
    document_limit: r.document_limit == null ? null : Number(r.document_limit),
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
  const highlight = Boolean(payload?.highlight);
  const is_active = payload?.is_active !== false;

  const v2 = resolveLimitsFromAdminPayload(payload);

  let student_limit;
  let storage_gb;
  let storage_limit_bytes;
  let sms_limit;
  let exam_limit;
  let homework_limit;
  let document_limit;
  let ram_limit_mb;
  let features;

  if (v2) {
    student_limit = v2.student_limit;
    sms_limit = v2.sms_limit;
    if (Object.prototype.hasOwnProperty.call(payload || {}, 'unlimited_exams')) {
      exam_limit = v2.exam_limit;
    } else {
      const { rows: curEx } = await db.query(
        `SELECT exam_limit FROM subscription_plans WHERE slug = $1 LIMIT 1`,
        [slug]
      );
      exam_limit = curEx[0]?.exam_limit == null ? null : Number(curEx[0].exam_limit);
      if (!Number.isFinite(exam_limit)) exam_limit = null;
    }
    if (Object.prototype.hasOwnProperty.call(payload || {}, 'unlimited_homeworks')) {
      homework_limit = v2.homework_limit;
    } else {
      const { rows: curHw } = await db.query(
        `SELECT homework_limit FROM subscription_plans WHERE slug = $1 LIMIT 1`,
        [slug]
      );
      homework_limit = curHw[0]?.homework_limit == null ? null : Number(curHw[0].homework_limit);
      if (!Number.isFinite(homework_limit)) homework_limit = null;
    }
    if (Object.prototype.hasOwnProperty.call(payload || {}, 'unlimited_documents')) {
      document_limit = v2.document_limit;
    } else {
      const { rows: curDoc } = await db.query(
        `SELECT document_limit FROM subscription_plans WHERE slug = $1 LIMIT 1`,
        [slug]
      );
      document_limit = curDoc[0]?.document_limit == null ? null : Number(curDoc[0].document_limit);
      if (!Number.isFinite(document_limit)) document_limit = null;
    }
    storage_gb = v2.storage_gb;
    storage_limit_bytes = v2.storage_limit_bytes;
    if (Object.prototype.hasOwnProperty.call(payload || {}, 'ram_limit_mb')) {
      ram_limit_mb = payload?.ram_limit_mb === '' || payload?.ram_limit_mb == null ? null : Number(payload.ram_limit_mb);
      if (!Number.isFinite(ram_limit_mb)) ram_limit_mb = null;
    } else {
      const { rows: curRam } = await db.query(`SELECT ram_limit_mb FROM subscription_plans WHERE slug = $1 LIMIT 1`, [slug]);
      ram_limit_mb = curRam[0]?.ram_limit_mb == null ? null : Number(curRam[0].ram_limit_mb);
      if (!Number.isFinite(ram_limit_mb)) ram_limit_mb = null;
    }
    features = buildPlanFeaturesFromLimits({
      slug,
      student_limit,
      document_limit,
      sms_limit,
      exam_limit,
      homework_limit,
      storage_gb,
      storage_limit_bytes,
    });
  } else {
    student_limit = payload?.student_limit === '' ? null : payload?.student_limit;
    storage_gb = payload?.storage_gb === '' ? null : payload?.storage_gb;
    const hasStorageLimitBytesKey = Object.prototype.hasOwnProperty.call(payload || {}, 'storage_limit_bytes');
    if (hasStorageLimitBytesKey) {
      storage_limit_bytes = payload?.storage_limit_bytes === '' ? null : Number(payload?.storage_limit_bytes);
      if (!Number.isFinite(storage_limit_bytes)) storage_limit_bytes = null;
    } else {
      const { rows: curSb } = await db.query(
        `SELECT storage_limit_bytes FROM subscription_plans WHERE slug = $1 LIMIT 1`,
        [slug],
      );
      storage_limit_bytes =
        curSb[0]?.storage_limit_bytes == null ? null : Number(curSb[0].storage_limit_bytes);
      if (!Number.isFinite(storage_limit_bytes)) storage_limit_bytes = null;
    }
    sms_limit = payload?.sms_limit === '' ? null : payload?.sms_limit;
    if (Object.prototype.hasOwnProperty.call(payload || {}, 'exam_limit')) {
      exam_limit = payload?.exam_limit === '' ? null : payload?.exam_limit;
    } else {
      const { rows: curEx } = await db.query(
        `SELECT exam_limit FROM subscription_plans WHERE slug = $1 LIMIT 1`,
        [slug]
      );
      exam_limit = curEx[0]?.exam_limit == null ? null : Number(curEx[0].exam_limit);
      if (!Number.isFinite(exam_limit)) exam_limit = null;
    }
    if (Object.prototype.hasOwnProperty.call(payload || {}, 'homework_limit')) {
      homework_limit = payload?.homework_limit === '' ? null : payload?.homework_limit;
    } else {
      const { rows: curHw } = await db.query(
        `SELECT homework_limit FROM subscription_plans WHERE slug = $1 LIMIT 1`,
        [slug]
      );
      homework_limit = curHw[0]?.homework_limit == null ? null : Number(curHw[0].homework_limit);
      if (!Number.isFinite(homework_limit)) homework_limit = null;
    }
    ram_limit_mb = payload?.ram_limit_mb === '' ? null : payload?.ram_limit_mb;

    features = payload?.features ?? null;
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
  }

  await db.query(
    `INSERT INTO subscription_plans (slug, title, price_azn, student_limit, document_limit, storage_gb, storage_limit_bytes, sms_limit, exam_limit, homework_limit, ram_limit_mb, features, highlight, is_active, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,NOW())
     ON CONFLICT (slug) DO UPDATE SET
       title=EXCLUDED.title,
       price_azn=EXCLUDED.price_azn,
       student_limit=EXCLUDED.student_limit,
       document_limit=EXCLUDED.document_limit,
       storage_gb=EXCLUDED.storage_gb,
       storage_limit_bytes=EXCLUDED.storage_limit_bytes,
       sms_limit=EXCLUDED.sms_limit,
       exam_limit=EXCLUDED.exam_limit,
       homework_limit=EXCLUDED.homework_limit,
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
      document_limit == null ? null : Number(document_limit),
      storage_gb == null ? null : Number(storage_gb),
      storage_limit_bytes,
      sms_limit == null ? null : Number(sms_limit),
      exam_limit == null ? null : Number(exam_limit),
      homework_limit == null ? null : Number(homework_limit),
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
  buildPlanFeaturesFromLimits,
};

