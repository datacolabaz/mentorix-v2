const db = require('../utils/db');
const { getCategoryById } = require('./categoryService');
const { getCategorySubtreeIds } = require('./categoryService');
const { normalizePlanSlug } = require('../config/plans');
const { shouldReceiveSearchOpportunityAlerts } = require('./mapListingPlanService');

const NOTIFY_TYPE = 'marketplace_opportunity';
const DEDUPE_HOURS = 24;

function buildOpportunityBody(areaLabel, subjectLabel) {
  const area = areaLabel || 'seçilmiş ərazidə';
  const subject = subjectLabel || 'müəllim';
  return `🔥 Yeni tələbə fürsəti: ${area} rayonunda ${subject} axtarılır. Profilinizi Premium və ya Growth paketə yüksəldin və axtarış nəticələrində həmişə ən yuxarıda görünün.`;
}

async function resolveAreaName(areaId) {
  if (!areaId) return null;
  const { rows } = await db.query(`SELECT name_az FROM service_areas WHERE id = $1 LIMIT 1`, [areaId]);
  return rows[0]?.name_az || null;
}

async function resolveSubjectLabel({ categoryId, searchQ }) {
  const q = String(searchQ || '').trim();
  if (categoryId) {
    const cat = await getCategoryById(categoryId);
    if (cat?.name_az) return cat.name_az;
  }
  if (q.length >= 2) return q;
  return null;
}

/**
 * İctimai axtarışda fənn + ərazi seçiləndə SADƏ/PRO müəllimlərə dashboard trigger bildirişi.
 * Fire-and-forget — axtarış cavabını gecikdirmir.
 */
async function notifyMarketplaceSearchOpportunity({
  categoryId,
  areaId,
  searchQ,
  north,
  south,
  east,
  west,
  kind,
  format,
}) {
  const subjectLabel = await resolveSubjectLabel({ categoryId, searchQ });
  const areaLabel = await resolveAreaName(areaId);

  const hasSubject = Boolean(subjectLabel);
  const hasLocation = Boolean(areaId) || (north != null && south != null && east != null && west != null);
  if (!hasSubject || !hasLocation) return { skipped: true, reason: 'insufficient_context' };

  const params = [];
  let i = 1;
  const where = [
    `u.role = 'instructor'`,
    `COALESCE(u.is_active, TRUE) = TRUE`,
    `u.deleted_at IS NULL`,
    `COALESCE(ip.map_visible, TRUE) = TRUE`,
    `ip.latitude IS NOT NULL`,
    `ip.longitude IS NOT NULL`,
    `LOWER(TRIM(COALESCE(s.plan, 'basic')::text)) IN ('basic', 'pro')`,
  ];

  if (kind === 'teacher' || kind === 'trainer') {
    where.push(`ip.map_profile_kind = $${i++}`);
    params.push(kind);
  }

  if (categoryId) {
    const categoryIds = await getCategorySubtreeIds(categoryId);
    if (categoryIds.length) {
      where.push(`EXISTS (
        SELECT 1 FROM instructor_categories ic
        WHERE ic.user_id = u.id AND ic.category_id = ANY($${i++}::varchar[])
      )`);
      params.push(categoryIds);
    }
  } else if (subjectLabel && String(searchQ || '').trim().length >= 2) {
    where.push(`(
      u.full_name ILIKE $${i}
      OR COALESCE(ip.subject, '') ILIKE $${i}
      OR COALESCE(ip.discover_bio, '') ILIKE $${i}
    )`);
    params.push(`%${String(searchQ).trim()}%`);
    i++;
  }

  if (areaId) {
    where.push(`EXISTS (
      SELECT 1 FROM instructor_service_areas isa
      WHERE isa.user_id = u.id AND isa.area_id = $${i++}
    )`);
    params.push(areaId);
  } else if (north != null && south != null && east != null && west != null) {
    params.push(north, south, west, east);
    where.push(`ip.latitude BETWEEN $${i + 1} AND $${i}`);
    where.push(
      `ip.longitude BETWEEN LEAST($${i + 2}::float8, $${i + 3}::float8) AND GREATEST($${i + 2}::float8, $${i + 3}::float8)`,
    );
    i += 4;
  }

  const fmt = String(format || 'any').toLowerCase();
  if (['online', 'teacher_place', 'student_place'].includes(fmt)) {
    where.push(`EXISTS (
      SELECT 1 FROM instructor_delivery_formats df
      WHERE df.user_id = u.id AND df.format = $${i++}::delivery_format
    )`);
    params.push(fmt);
  }

  const { rows: instructors } = await db.query(
    `SELECT u.id AS user_id, COALESCE(s.plan, 'basic') AS plan
     FROM users u
     INNER JOIN instructor_profiles ip ON ip.user_id = u.id
     LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
     WHERE ${where.join(' AND ')}
     LIMIT 80`,
    params,
  );

  if (!instructors.length) return { notified: 0 };

  const searchKey = [
    categoryId || '',
    areaId || '',
    String(searchQ || '').trim().toLowerCase().slice(0, 80),
    kind || 'all',
    fmt,
  ].join('|');

  const title = '🔥 Yeni tələbə fürsəti';
  const body = buildOpportunityBody(areaLabel, subjectLabel);
  let notified = 0;

  for (const row of instructors) {
    if (!shouldReceiveSearchOpportunityAlerts(row.plan)) continue;
    const userId = row.user_id;
    const { rows: dup } = await db.query(
      `SELECT 1 FROM notifications
       WHERE user_id = $1
         AND type = $2
         AND COALESCE(meta->>'search_key', '') = $3
         AND created_at > NOW() - ($4::text || ' hours')::interval
       LIMIT 1`,
      [userId, NOTIFY_TYPE, searchKey, String(DEDUPE_HOURS)],
    );
    if (dup[0]) continue;

    await db.query(
      `INSERT INTO notifications (user_id, title, body, type, is_read, meta)
       VALUES ($1, $2, $3, $4, FALSE, $5::jsonb)`,
      [
        userId,
        title,
        body,
        NOTIFY_TYPE,
        JSON.stringify({
          search_key: searchKey,
          category_id: categoryId || null,
          category_name: subjectLabel,
          area_id: areaId || null,
          area_name: areaLabel,
        }),
      ],
    );
    notified += 1;
  }

  return { notified, search_key: searchKey };
}

async function getLatestMarketplaceOpportunity(userId) {
  const { rows: planRows } = await db.query(
    `SELECT COALESCE(s.plan, 'basic') AS plan
     FROM users u
     LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
     WHERE u.id = $1 LIMIT 1`,
    [userId],
  );
  const plan = normalizePlanSlug(planRows[0]?.plan);
  if (!shouldReceiveSearchOpportunityAlerts(plan)) {
    return { eligible: false, plan, opportunity: null };
  }

  const { rows } = await db.query(
    `SELECT id, title, body, type, is_read, created_at, COALESCE(meta, '{}'::jsonb) AS meta
     FROM notifications
     WHERE user_id = $1 AND type = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, NOTIFY_TYPE],
  );

  const row = rows[0];
  if (!row) return { eligible: true, plan, opportunity: null };

  return {
    eligible: true,
    plan,
    opportunity: {
      id: row.id,
      title: row.title,
      body: row.body,
      is_read: row.is_read,
      created_at: row.created_at,
      meta: row.meta,
      cta_label: 'Paketi yüksəlt',
      cta_path: '/instructor/settings',
    },
  };
}

module.exports = {
  notifyMarketplaceSearchOpportunity,
  getLatestMarketplaceOpportunity,
  buildOpportunityBody,
};
