/**
 * Bildiriş mərkəzi sorğuları. Hər sorğu `user_id = <cari istifadəçi>` ilə məhdudlaşır —
 * başqasının bildirişi heç vaxt oxunmur/dəyişdirilmir.
 */
const db = require('../utils/db');
const policy = require('../config/notificationPolicy');
const { targetFor } = require('./notificationLinkResolver');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const CURSOR_TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?$/;

const SELECT_COLUMNS = `
  n.id, n.user_id, n.title, n.body, n.type, n.is_read, n.read_at, n.meta,
  n.category, n.priority, n.related_entity_type, n.related_entity_id,
  n.actor_user_id, n.provider_workspace_id, n.group_id,
  n.email_status, n.email_sent_at, n.dedupe_key,
  (n.created_at AT TIME ZONE 'UTC') AS created_at,
  to_char(n.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.US') AS cursor_ts`;

/** Səssiz (in-app söndürülmüş, yalnız email niyyəti üçün saxlanılan) sətirlər siyahıda görünmür. */
const VISIBLE_SQL = `NOT (n.meta @> '{"silent": true}'::jsonb)`;

function parseMeta(meta) {
  if (!meta) return {};
  if (typeof meta === 'object') return meta;
  try {
    return JSON.parse(meta);
  } catch {
    return {};
  }
}

function encodeCursor(row) {
  return Buffer.from(JSON.stringify({ t: row.cursor_ts, id: row.id })).toString('base64url');
}

function decodeCursor(raw) {
  if (!raw) return null;
  try {
    const obj = JSON.parse(Buffer.from(String(raw), 'base64url').toString('utf8'));
    if (!obj || !CURSOR_TS_RE.test(String(obj.t || '')) || !UUID_RE.test(String(obj.id || ''))) return null;
    return { t: String(obj.t), id: String(obj.id) };
  } catch {
    return null;
  }
}

/** Kateqoriya filtri: yeni sütun və ya (category IS NULL olan köhnə sətirlər üçün) type xəritəsi. */
function categoryCondition(category, params) {
  const f = policy.legacyTypeFilter(category);
  const p = (v) => {
    params.push(v);
    return `$${params.length}`;
  };
  const t = `LOWER(COALESCE(n.type, ''))`;
  const pc = p(category);
  const pe = p(f.exact);
  const pp = p(f.prefixes);
  const pae = p(f.allExact);
  let legacy = `${t} = ANY(${pe}::text[]) OR (${t} LIKE ANY(${pp}::text[]) AND NOT (${t} = ANY(${pae}::text[])))`;
  if (f.includeUnmapped) {
    const pap = p(f.allPrefixes);
    legacy += ` OR NOT (${t} = ANY(${pae}::text[]) OR ${t} LIKE ANY(${pap}::text[]))`;
  }
  return `(n.category = ${pc} OR (n.category IS NULL AND (${legacy})))`;
}

function serializeNotification(row) {
  const { category, priority } = policy.classifyNotification(row);
  const meta = parseMeta(row.meta);
  const i18n =
    meta.i18n && typeof meta.i18n === 'object' && typeof meta.i18n.key === 'string'
      ? { key: meta.i18n.key, params: meta.i18n.params && typeof meta.i18n.params === 'object' ? meta.i18n.params : {} }
      : null;
  return {
    id: row.id,
    recipient_user_id: row.user_id,
    category,
    event_type: row.type || null,
    priority,
    title: row.title || '',
    body: row.body || '',
    i18n,
    related_entity_type: row.related_entity_type || null,
    related_entity_id: row.related_entity_id || null,
    actor_user_id: row.actor_user_id || null,
    provider_workspace_id: row.provider_workspace_id || null,
    group_id: row.group_id || null,
    is_read: Boolean(row.is_read),
    read_at: row.read_at || null,
    created_at: row.created_at || null,
    email_status: row.email_status || null,
    email_sent_at: row.email_sent_at || null,
    dedupe_key: row.dedupe_key || null,
    has_link: Boolean(targetFor(row)),
  };
}

function badRequest(message, code = 'INVALID_QUERY') {
  const err = new Error(message);
  err.statusCode = 400;
  err.code = code;
  return err;
}

async function listNotifications(userId, { limit, cursor, category, unread } = {}) {
  const lim = Math.min(MAX_LIMIT, Math.max(1, Number(limit) || DEFAULT_LIMIT));
  const params = [userId];
  const where = ['n.user_id = $1', VISIBLE_SQL];

  if (category) {
    if (!policy.isCategory(category)) throw badRequest('unknown category', 'INVALID_CATEGORY');
    where.push(categoryCondition(category, params));
  }
  if (unread) where.push('n.is_read = FALSE');
  if (cursor) {
    const c = decodeCursor(cursor);
    if (!c) throw badRequest('invalid cursor', 'INVALID_CURSOR');
    params.push(c.t, c.id);
    where.push(`(n.created_at, n.id) < ($${params.length - 1}::timestamp, $${params.length}::uuid)`);
  }
  params.push(lim + 1);

  const { rows } = await db.query(
    `SELECT ${SELECT_COLUMNS}
     FROM notifications n
     WHERE ${where.join(' AND ')}
     ORDER BY n.created_at DESC, n.id DESC
     LIMIT $${params.length}`,
    params,
  );
  const page = rows.slice(0, lim);
  return {
    notifications: page.map(serializeNotification),
    next_cursor: rows.length > lim && page.length ? encodeCursor(page[page.length - 1]) : null,
  };
}

async function countUnread(userId) {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND is_read = FALSE`,
    [userId],
  );
  return Number(rows[0]?.n) || 0;
}

async function getOwnNotification(userId, id) {
  if (!UUID_RE.test(String(id || ''))) return null;
  const { rows } = await db.query(
    `SELECT ${SELECT_COLUMNS} FROM notifications n WHERE n.id = $1 AND n.user_id = $2 LIMIT 1`,
    [id, userId],
  );
  return rows[0] || null;
}

async function markRead(userId, id) {
  if (!UUID_RE.test(String(id || ''))) return false;
  const { rowCount } = await db.query(
    `UPDATE notifications
     SET is_read = TRUE, read_at = COALESCE(read_at, NOW())
     WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );
  return rowCount > 0;
}

async function markAllRead(userId, { category } = {}) {
  const params = [userId];
  const where = ['n.user_id = $1', 'n.is_read = FALSE'];
  if (category) {
    if (!policy.isCategory(category)) throw badRequest('unknown category', 'INVALID_CATEGORY');
    where.push(categoryCondition(category, params));
  }
  const { rowCount } = await db.query(
    `UPDATE notifications n
     SET is_read = TRUE, read_at = COALESCE(n.read_at, NOW())
     WHERE ${where.join(' AND ')}`,
    params,
  );
  return rowCount || 0;
}

module.exports = {
  listNotifications,
  countUnread,
  getOwnNotification,
  markRead,
  markAllRead,
  serializeNotification,
  encodeCursor,
  decodeCursor,
  categoryCondition,
};
