/**
 * Əl ilə göndərilən xatırlatmanın çatdırıldığı yeganə yer — notificationService üzərindən, çağıranın
 * tranzaksiyasında. Bildiriş sətri və email outbox sətri eyni tranzaksiyada yazılır: sendReminders
 * rollback olunsa heç biri qalmır, commit olunsa ikisi də qalır.
 * Hər alıcı ayrıca SAVEPOINT-dədir: bir tələbəyə yazmaq alınmasa, digərlərinin xatırlatması və
 * bu uğursuzluğun reminder_log qeydi eyni tranzaksiyada saxlanılır.
 * Qaytarılan forma ({ status, channel, notificationId, errorCode }) engagementService.sendReminders-ə bağlıdır.
 */
const { createNotificationInTransaction } = require('./notificationService');

const REMINDER_CATEGORY = Object.freeze({ material: 'material', assignment: 'assignment', exam: 'assessment' });

const FAILURE_CODES = Object.freeze({
  disabled_by_preference: 'DISABLED_BY_PREFERENCE',
  recipient_not_found: 'RECIPIENT_NOT_FOUND',
});

async function deliverReminderNotification(
  client,
  { recipientId, instructorId, entityType, entityId, type, title, body, meta = {}, dedupeKey = null, savepoint = 'reminder_delivery' },
) {
  const out = await createNotificationInTransaction(
    client,
    {
      recipientId,
      category: REMINDER_CATEGORY[entityType] || 'system',
      eventType: type,
      priority: 'NORMAL',
      title,
      body,
      meta: { ...meta, entity_type: entityType, entity_id: entityId, sent_by: instructorId, reminder_kind: 'manual' },
      relatedEntityType: entityType,
      relatedEntityId: entityId,
      actorUserId: instructorId,
      providerWorkspaceId: instructorId,
      dedupeKey,
      email: true,
    },
    { savepoint },
  );
  if (out.created || out.deduped) {
    return {
      status: 'delivered',
      channel: out.inApp === false ? 'email' : 'in_app',
      notificationId: out.id || null,
      errorCode: null,
      emailQueued: Boolean(out.emailQueued),
    };
  }
  return {
    status: 'failed',
    channel: 'in_app',
    notificationId: null,
    errorCode: String(out.errorCode || FAILURE_CODES[out.reason] || 'DELIVERY_FAILED').slice(0, 40),
    emailQueued: false,
  };
}

module.exports = { deliverReminderNotification, REMINDER_CATEGORY };
