/**
 * Mərkəzi bildiriş servisi: dedupe ilə yaratma, seçimlərin email niyyətindən ƏVVƏL yoxlanması,
 * security kateqoriyasının söndürülə bilməməsi. Yeni call site-lar birbaşa
 * `INSERT INTO notifications` əvəzinə bunu istifadə etməlidir.
 */
const crypto = require('crypto');
const db = require('../utils/db');
const policy = require('../config/notificationPolicy');
const { emailPlan, EMAIL_STATUS, EMAIL_ROUTE } = require('./notificationEmailGate');
const { hasTemplate, renderTemplate } = require('./notificationTemplates');
const { emailLocale, renderEmail, notificationTemplateKey, GENERIC_NOTIFICATION_KEY } = require('./email/emailTemplates');
const { appLink } = require('./email/emailConfig');
const { formatDateTime } = require('../utils/formatDateTime');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TITLE = 255;
const MAX_BODY = 2000;
const MAX_EVENT_TYPE = 50;
const MAX_DEDUPE_KEY = 200;
const MAX_ENTITY_TYPE = 50;

function isUuid(v) {
  return UUID_RE.test(String(v || ''));
}

function invalid(message) {
  const err = new Error(message);
  err.code = 'INVALID_NOTIFICATION';
  return err;
}

function optionalUuid(v, name) {
  if (v == null || v === '') return null;
  if (!isUuid(v)) throw invalid(`${name} must be a uuid`);
  return String(v);
}

function clip(v, max) {
  const s = String(v ?? '').trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** Giriş məlumatını yoxlayır və normallaşdırır (DB-siz). */
function normalizeInput(input = {}) {
  const recipientId = String(input.recipientId || '').trim();
  if (!isUuid(recipientId)) throw invalid('recipientId must be a uuid');
  const category = String(input.category || '').trim();
  if (!policy.isCategory(category)) throw invalid(`unknown category: ${category}`);
  const eventType = String(input.eventType || '').trim().toLowerCase();
  if (!/^[a-z0-9_]+$/.test(eventType) || eventType.length > MAX_EVENT_TYPE) {
    throw invalid('eventType must be snake_case (max 50 chars)');
  }
  const priority = input.priority ? String(input.priority).toUpperCase() : policy.defaultPriority(category);
  if (!policy.isPriority(priority)) throw invalid(`unknown priority: ${priority}`);
  const dedupeKey = input.dedupeKey == null || input.dedupeKey === '' ? null : String(input.dedupeKey).trim();
  if (dedupeKey && dedupeKey.length > MAX_DEDUPE_KEY) throw invalid('dedupeKey too long');
  const relatedEntityType = input.relatedEntityType ? clip(input.relatedEntityType, MAX_ENTITY_TYPE) : null;
  const params = input.params && typeof input.params === 'object' ? input.params : {};
  const meta = input.meta && typeof input.meta === 'object' && !Array.isArray(input.meta) ? { ...input.meta } : {};

  return {
    recipientId,
    category,
    eventType,
    priority,
    title: input.title == null ? '' : String(input.title),
    body: input.body == null ? '' : String(input.body),
    params,
    meta,
    dedupeKey,
    relatedEntityType,
    relatedEntityId: optionalUuid(input.relatedEntityId, 'relatedEntityId'),
    actorUserId: optionalUuid(input.actorUserId, 'actorUserId'),
    providerWorkspaceId: optionalUuid(input.providerWorkspaceId, 'providerWorkspaceId'),
    groupId: optionalUuid(input.groupId, 'groupId'),
    wantsEmail: input.email === true,
  };
}

async function loadRecipient(q, recipientId) {
  const { rows } = await q.query(
    `SELECT id, role, locale, is_active, deleted_at FROM users WHERE id = $1 LIMIT 1`,
    [recipientId],
  );
  const u = rows[0];
  if (!u || u.is_active === false || u.deleted_at) return null;
  return u;
}

async function loadPreferences(q, userId, category) {
  try {
    const { rows } = await q.query(
      `SELECT category, event_type, channel, enabled, frequency
       FROM notification_preferences
       WHERE user_id = $1 AND category = $2`,
      [userId, category],
    );
    return rows || [];
  } catch (err) {
    if (err && err.code === '42P01') return [];
    throw err;
  }
}

function renderText(n, locale) {
  const rendered = hasTemplate(n.eventType) ? renderTemplate(n.eventType, locale, n.params) : null;
  const title = clip(rendered?.title || n.title, MAX_TITLE);
  const body = clip(rendered?.body || n.body, MAX_BODY);
  if (!title) throw invalid('title required (or a template for eventType)');
  return { title, body, templated: Boolean(rendered) };
}

/**
 * Legacy-route email (old SMTP path, see notificationEmailGate.emailRoute): rendered now from
 * the same notification email template, because legacy queue rows carry their own text.
 */
function renderLegacyEmail(n, text, locale, notificationId) {
  const key = notificationTemplateKey(n.eventType);
  const params = key === GENERIC_NOTIFICATION_KEY ? { title: text.title, body: text.body } : { ...n.params };
  params.when = formatDateTime(new Date(), locale);
  const email = renderEmail(key, locale, params, { ctaUrl: appLink(`/notifications?open=${notificationId}`) });
  return { subject: email.subject, body: email.text };
}

async function legacyInsert(q, n, text, meta) {
  const { rows } = await q.query(
    `INSERT INTO notifications (user_id, title, body, type, is_read, meta)
     VALUES ($1, $2, $3, $4, FALSE, $5::jsonb)
     RETURNING id`,
    [n.recipientId, text.title, text.body, n.eventType, JSON.stringify(meta)],
  );
  return rows[0]?.id || null;
}

/**
 * @param {object} input
 * @param {string} input.recipientId
 * @param {string} input.category        policy.CATEGORIES
 * @param {string} input.eventType       snake_case, saxlanılır `notifications.type`-da
 * @param {string} [input.priority]      CRITICAL|HIGH|NORMAL|LOW
 * @param {string} [input.title]         şablon yoxdursa məcburidir
 * @param {string} [input.body]
 * @param {object} [input.params]        şablon parametrləri (gizli məlumat YOX)
 * @param {object} [input.meta]          köhnə oxucular üçün (assignment_id, exam_id, ...)
 * @param {string} [input.dedupeKey]     alıcı üzrə unikal
 * @param {boolean} [input.email]        hadisə email tələb edirmi (seçim/siyasət yenə də yoxlanır)
 * @param {{ client?: { query: Function } }} [opts] tranzaksiya client-i
 */
async function createNotification(input, opts = {}) {
  const q = opts.client || db;
  const n = normalizeInput(input);

  const recipient = await loadRecipient(q, n.recipientId);
  if (!recipient) return { created: false, deduped: false, id: null, reason: 'recipient_not_found' };

  const prefs = policy.isMandatory(n) ? [] : await loadPreferences(q, n.recipientId, n.category);
  const decision = policy.resolveDelivery({
    role: recipient.role,
    category: n.category,
    eventType: n.eventType,
    prefs,
    wantsEmail: n.wantsEmail,
  });

  const plan = emailPlan({ eventType: n.eventType, emailDecision: decision.email });
  const emailStatus = plan.status;
  if (!decision.inApp && (emailStatus == null || emailStatus === EMAIL_STATUS.SKIPPED)) {
    return { created: false, deduped: false, id: null, reason: 'disabled_by_preference' };
  }

  const text = renderText(n, recipient.locale);
  const meta = { ...n.meta };
  if (text.templated) meta.i18n = { key: n.eventType, params: n.params };
  if (!decision.inApp) meta.silent = true;
  if (emailStatus === EMAIL_STATUS.DIGEST) meta.email_frequency = decision.email.frequency;
  if (plan.route === EMAIL_ROUTE.LEGACY) meta.email_route = 'legacy';

  // The email row is written by the same statement (atomic, no transaction needed), only when
  // a new notification row was inserted — a deduped retry never queues a second email.
  // Outbox rows hold ids/template/locale only (rendered at send time). Legacy rows carry the
  // rendered text, like every other legacy queue row. At most one of the two is written.
  const locale = emailLocale(recipient.locale);
  const newId = crypto.randomUUID();
  const enqueueOutbox = plan.route === EMAIL_ROUTE.OUTBOX;
  const enqueueLegacy = plan.route === EMAIL_ROUTE.LEGACY;
  const legacyEmail = enqueueLegacy ? renderLegacyEmail(n, text, locale, newId) : { subject: null, body: null };
  let id = null;
  let queued = false;
  try {
    const { rows } = await q.query(
      `WITH ins AS (
         INSERT INTO notifications (
           user_id, title, body, type, is_read, read_at, meta,
           category, priority, related_entity_type, related_entity_id,
           actor_user_id, provider_workspace_id, group_id, email_status, dedupe_key, id
         ) VALUES (
           $1, $2, $3, $4::text, $5::boolean, CASE WHEN $5::boolean THEN NOW() ELSE NULL END, $6::jsonb,
           $7, $8, $9, $10, $11, $12, $13, $14, $15, $18::uuid
         )
         ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
         RETURNING id, user_id
       ), outbox AS (
         INSERT INTO notification_queue (
           channel, event_type, unique_key, user_id, to_addr, status, retry_count, next_retry_at,
           notification_id, template_key, locale
         )
         SELECT 'email', $4::text, 'email:notification:' || ins.id::text, ins.user_id, '__resolve__', 'queued', 0, NOW(),
                ins.id, $4::text, $16::varchar
         FROM ins
         WHERE $17::boolean
         ON CONFLICT (unique_key) DO NOTHING
         RETURNING id
       ), legacy AS (
         INSERT INTO notification_queue (
           channel, event_type, unique_key, user_id, to_addr, subject, body, status, retry_count, next_retry_at,
           notification_id
         )
         SELECT 'email', $4::text, 'email:legacy:' || ins.id::text, ins.user_id, '__resolve__', $19::text, $20::text,
                'pending', 0, NOW(), ins.id
         FROM ins
         WHERE $21::boolean AND NOT $17::boolean
         ON CONFLICT (unique_key) DO NOTHING
         RETURNING id
       )
       SELECT ins.id,
              (SELECT COUNT(*) FROM outbox)::int AS queued,
              (SELECT COUNT(*) FROM legacy)::int AS legacy_queued
       FROM ins`,
      [
        n.recipientId,
        text.title,
        text.body,
        n.eventType,
        !decision.inApp,
        JSON.stringify(meta),
        n.category,
        n.priority,
        n.relatedEntityType,
        n.relatedEntityId,
        n.actorUserId,
        n.providerWorkspaceId,
        n.groupId,
        emailStatus,
        n.dedupeKey,
        locale,
        enqueueOutbox,
        newId,
        legacyEmail.subject,
        legacyEmail.body,
        enqueueLegacy,
      ],
    );
    id = rows[0]?.id || null;
    queued = Number(rows[0]?.queued || 0) + Number(rows[0]?.legacy_queued || 0) > 0;
  } catch (err) {
    // Migrasiya 214 hələ tətbiq olunmayıbsa (yalnız lokal/köhnə DB) — köhnə formada yaz.
    if (err && err.code === '42703') {
      id = await legacyInsert(q, n, text, meta);
      return { created: Boolean(id), deduped: false, id, inApp: true, emailStatus: null, legacy: true };
    }
    throw err;
  }

  if (!id) return { created: false, deduped: true, id: null, inApp: decision.inApp, emailStatus };
  return { created: true, deduped: false, id, inApp: decision.inApp, emailStatus, emailRoute: plan.route, emailQueued: queued };
}

/** Fire-and-forget call site-lar üçün: xəta istifadəçi axınını pozmur. */
async function createNotificationSafe(input, opts = {}) {
  try {
    return await createNotification(input, opts);
  } catch (err) {
    console.error('[notificationService]', input?.eventType || '?', err?.code || '', err?.message || err);
    return { created: false, deduped: false, id: null, reason: 'error' };
  }
}

module.exports = { createNotification, createNotificationSafe, normalizeInput, isUuid };
