/**
 * Ödəniş/abunəlik bildirişləri üçün ortaq yazıcı (əvvəl üç faylda ayrı-ayrı `ensureNotificationOnce` var idi).
 * Köhnə davranış saxlanılır: eyni alıcıya eyni tip + mətn son 45 gündə getmişsə, yenisi yazılmır.
 * Əlavə olaraq sabit, obyektə bağlı dedupe açarı (enrollment/payment/cycle) paralel sorğu, replika
 * və təkrar cəhdlərdə ikinci sətrin qarşısını DB səviyyəsində alır. E-poçt yalnız `email: true` verildikdə
 * (tələbəyə ödəniş xatırlatması; SMS-in yerinə) və alıcının "billing" e-poçt seçimi açıqdırsa.
 */
const db = require('../utils/db');

const LEGACY_WINDOW_DAYS = 45;

/**
 * @param {{ userId: string, type: string, title: string, body: string, dedupeKey: string,
 *   priority?: string, meta?: object, relatedEntityType?: string, relatedEntityId?: string,
 *   actorUserId?: string, providerWorkspaceId?: string, email?: boolean }} input
 * @returns {Promise<boolean>} yeni bildiriş yazıldımı
 */
async function notifyBillingOnce(input) {
  if (!input?.userId) return false;
  try {
    const { rows } = await db.query(
      `SELECT 1 FROM notifications
       WHERE user_id = $1 AND type = $2 AND body = $3
         AND created_at > NOW() - make_interval(days => $4)
       LIMIT 1`,
      [input.userId, input.type, input.body, LEGACY_WINDOW_DAYS],
    );
    if (rows.length) return false;
  } catch (err) {
    console.error('[billingNotifications] precheck', input.type, err?.message || err);
    return false;
  }
  const { createNotificationSafe } = require('./notificationService');
  const out = await createNotificationSafe({
    recipientId: input.userId,
    category: 'billing',
    eventType: input.type,
    priority: input.priority || 'NORMAL',
    title: input.title,
    body: input.body,
    meta: input.meta || {},
    relatedEntityType: input.relatedEntityType || null,
    relatedEntityId: input.relatedEntityId || null,
    actorUserId: input.actorUserId || null,
    providerWorkspaceId: input.providerWorkspaceId || null,
    dedupeKey: input.dedupeKey,
    email: input.email === true,
  });
  return Boolean(out.created);
}

module.exports = { notifyBillingOnce, LEGACY_WINDOW_DAYS };
