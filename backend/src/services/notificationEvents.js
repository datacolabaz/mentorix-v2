/**
 * In-process communication events. Per the plan, NOTIFICATION_DELIVERED / NOTIFICATION_FAILED
 * are recorded by the notification_queue row + notifications.email_status (not duplicated into
 * student_activity_log); this emitter lets other modules (admin ops, metrics) react without
 * polling. Payloads carry ids and codes only — no addresses or content.
 */
const { EventEmitter } = require('events');

const NOTIFICATION_EVENTS = Object.freeze({
  DELIVERED: 'NOTIFICATION_DELIVERED',
  FAILED: 'NOTIFICATION_FAILED',
});

const notificationEvents = new EventEmitter();
notificationEvents.setMaxListeners(50);

function emitNotificationEvent(name, payload) {
  try {
    notificationEvents.emit(name, Object.freeze({ ...payload, event: name, at: new Date().toISOString() }));
  } catch (err) {
    console.error('[notificationEvents]', name, err?.message || err);
  }
}

module.exports = { notificationEvents, NOTIFICATION_EVENTS, emitNotificationEvent };
