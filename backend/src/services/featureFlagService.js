const db = require('../utils/db');
const { FEATURE_FLAG_DEFAULTS } = require('../constants/featureFlags');

const CACHE_TTL_MS = 30 * 1000;

let cache = null;
let cacheAt = 0;

function isKnownFlag(key) {
  return Object.prototype.hasOwnProperty.call(FEATURE_FLAG_DEFAULTS, key);
}

function invalidateFeatureFlagCache() {
  cache = null;
  cacheAt = 0;
}

async function loadFlagMap() {
  if (cache && Date.now() - cacheAt < CACHE_TTL_MS) return cache;
  const map = { ...FEATURE_FLAG_DEFAULTS };
  try {
    const { rows } = await db.query('SELECT key, enabled FROM platform_feature_flags');
    for (const row of rows) {
      if (isKnownFlag(row.key)) map[row.key] = row.enabled === true;
    }
  } catch (err) {
    // 42P01: cədvəl hələ yoxdur — default-larla davam et, tətbiqi yıxma.
    if (err?.code !== '42P01') console.error('[feature-flags] load failed:', err.message);
  }
  cache = map;
  cacheAt = Date.now();
  return map;
}

async function isFeatureEnabled(key) {
  const map = await loadFlagMap();
  return map[key] === true;
}

async function getFeatureFlagSnapshot() {
  return { ...(await loadFlagMap()) };
}

async function listFeatureFlags() {
  const map = await loadFlagMap();
  let rows = [];
  try {
    ({ rows } = await db.query(
      `SELECT f.key, f.enabled, f.description, f.updated_at, f.updated_by, u.full_name AS updated_by_name
       FROM platform_feature_flags f
       LEFT JOIN users u ON u.id = f.updated_by`,
    ));
  } catch (err) {
    if (err?.code !== '42P01') throw err;
  }
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return Object.keys(FEATURE_FLAG_DEFAULTS).map((key) => {
    const row = byKey.get(key);
    return {
      key,
      enabled: map[key] === true,
      default_enabled: FEATURE_FLAG_DEFAULTS[key],
      description: row?.description || null,
      updated_at: row?.updated_at || null,
      updated_by: row?.updated_by || null,
      updated_by_name: row?.updated_by_name || null,
    };
  });
}

async function setFeatureFlag(key, enabled, { actorId = null, ip = null, userAgent = null } = {}) {
  if (!isKnownFlag(key)) {
    const err = new Error('Naməlum funksiya açarı');
    err.statusCode = 400;
    throw err;
  }
  if (typeof enabled !== 'boolean') {
    const err = new Error('enabled true və ya false olmalıdır');
    err.statusCode = 400;
    throw err;
  }

  const result = await db.transaction(async (client) => {
    const { rows: prev } = await client.query(
      'SELECT enabled FROM platform_feature_flags WHERE key = $1 FOR UPDATE',
      [key],
    );
    const oldEnabled = prev.length ? prev[0].enabled === true : null;
    const { rows } = await client.query(
      `INSERT INTO platform_feature_flags (key, enabled, updated_at, updated_by)
       VALUES ($1, $2, NOW(), $3)
       ON CONFLICT (key) DO UPDATE
         SET enabled = EXCLUDED.enabled, updated_at = NOW(), updated_by = EXCLUDED.updated_by
       RETURNING key, enabled, updated_at`,
      [key, enabled, actorId],
    );
    if (oldEnabled !== enabled) {
      await client.query(
        `INSERT INTO platform_feature_flag_audit (flag_key, old_enabled, new_enabled, changed_by, ip, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [key, oldEnabled, enabled, actorId, ip ? String(ip).slice(0, 100) : null, userAgent ? String(userAgent).slice(0, 300) : null],
      );
    }
    return rows[0];
  });

  invalidateFeatureFlagCache();
  return result;
}

async function listFeatureFlagAudit({ limit = 50 } = {}) {
  const cap = Math.min(200, Math.max(1, Number(limit) || 50));
  const { rows } = await db.query(
    `SELECT a.id, a.flag_key, a.old_enabled, a.new_enabled, a.changed_at, a.changed_by, u.full_name AS changed_by_name
     FROM platform_feature_flag_audit a
     LEFT JOIN users u ON u.id = a.changed_by
     ORDER BY a.changed_at DESC, a.id DESC
     LIMIT $1`,
    [cap],
  );
  return rows;
}

module.exports = {
  isFeatureEnabled,
  isKnownFlag,
  getFeatureFlagSnapshot,
  listFeatureFlags,
  setFeatureFlag,
  listFeatureFlagAudit,
  invalidateFeatureFlagCache,
};
