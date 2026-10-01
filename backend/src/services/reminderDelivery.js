/**
 * Əl ilə göndərilən xatırlatmanın çatdırıldığı yeganə yer.
 * Hər alıcı ayrıca SAVEPOINT-dədir: bir tələbəyə yazmaq alınmasa, digərlərinin xatırlatması və
 * bu uğursuzluğun reminder_log qeydi eyni tranzaksiyada saxlanılır.
 *
 * TODO(Phase F): feat/notifications-core birləşəndən sonra INSERT-i
 *   notificationService.createNotification({ recipientId, category: entityType === 'exam' ? 'assessment' : entityType,
 *     eventType: type, priority: 'NORMAL', title, body, relatedEntityType: entityType, relatedEntityId: entityId,
 *     actorUserId: instructorId, providerWorkspaceId: instructorId, dedupeKey, meta })
 * ilə əvəz edin (email üstünlükləri də orada yoxlanılır). Qaytarılan forma ({ status, channel, notificationId, errorCode })
 * dəyişməməlidir — çağıran kod (engagementService.sendReminders) ona bağlıdır.
 */
async function deliverReminderNotification(
  client,
  { recipientId, instructorId, entityType, entityId, type, title, body, meta = {}, dedupeKey = null, savepoint = 'reminder_delivery' },
) {
  await client.query(`SAVEPOINT ${savepoint}`);
  try {
    const { rows } = await client.query(
      `INSERT INTO notifications (user_id, title, body, type, is_read, meta)
       VALUES ($1, $2, $3, $4, FALSE, $5::jsonb)
       RETURNING id`,
      [
        recipientId,
        title,
        body,
        type,
        JSON.stringify({ ...meta, entity_type: entityType, entity_id: entityId, sent_by: instructorId, dedupe_key: dedupeKey }),
      ],
    );
    await client.query(`RELEASE SAVEPOINT ${savepoint}`);
    return { status: 'delivered', channel: 'in_app', notificationId: rows[0]?.id || null, errorCode: null };
  } catch (err) {
    await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    return {
      status: 'failed',
      channel: 'in_app',
      notificationId: null,
      errorCode: String(err?.code || 'DELIVERY_FAILED').slice(0, 40),
    };
  }
}

module.exports = { deliverReminderNotification };
