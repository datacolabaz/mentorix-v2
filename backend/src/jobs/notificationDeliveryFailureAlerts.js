/**
 * Saatlıq admin xülasəsi: əvvəlki tam saatda çatdırılmayan (failed) email bildirişləri.
 * Hər saat üçün bir bildiriş (dedupe `notification_delivery_failed:{hourStartISO}`): bir neçə replika
 * və ya təkrar işə salınma eyni adminə ikinci sətir yaratmır. Uğursuzluq yoxdursa heç nə yazılmır.
 * Email yoxdur: email çatdırılmasının özü problemli ola bilər, bildiriş in-app-dir.
 */
const db = require('../utils/db');
const { notifyAdmins } = require('../services/notificationService');

const EVENT_TYPE = 'notification_delivery_failed';

function previousHourWindow(now = new Date()) {
  const to = new Date(now);
  to.setUTCMinutes(0, 0, 0);
  const from = new Date(to.getTime() - 3600 * 1000);
  return { from, to };
}

const hhmm = (d) => d.toISOString().slice(11, 16);

async function runNotificationDeliveryFailureAlerts({ now = new Date() } = {}) {
  const { from, to } = previousHourWindow(now);
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS failed
     FROM notification_queue
     WHERE status = 'failed' AND channel = 'email'
       AND failed_at >= $1 AND failed_at < $2
       AND COALESCE(event_type, '') <> $3`,
    [from.toISOString(), to.toISOString(), EVENT_TYPE],
  );
  const failed = Number(rows[0]?.failed || 0);
  if (!failed) return { failed: 0, recipients: 0, created: 0 };
  const out = await notifyAdmins({
    category: 'system',
    eventType: EVENT_TYPE,
    priority: 'HIGH',
    params: { count: failed, from: hhmm(from), to: hhmm(to) },
    meta: { failed, window_start: from.toISOString(), window_end: to.toISOString(), href: '/admin/notifications' },
    dedupeKey: `${EVENT_TYPE}:${from.toISOString()}`,
    email: false,
  });
  return { failed, ...out };
}

module.exports = { runNotificationDeliveryFailureAlerts, previousHourWindow, EVENT_TYPE };
