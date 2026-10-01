const test = require('node:test');
const assert = require('node:assert/strict');

/**
 * Real-Postgres check of the transaction-aware notification path (Phase F, reminders):
 *   rollback → no notification and no email outbox row; commit → both.
 * Opt-in: runs only when TEST_DATABASE_URL points at localhost (never a remote DB).
 * Uses a throwaway schema with the columns/indexes of migrations 065/214/216 and drops it afterwards.
 */

const url = process.env.TEST_DATABASE_URL || '';
let host = '';
try {
  host = url ? new URL(url).hostname : '';
} catch {
  host = '';
}
const LOCAL = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host);
const skip = LOCAL ? false : 'set TEST_DATABASE_URL to a localhost Postgres to run';

const dbId = require.resolve('../utils/db');
require.cache[dbId] = {
  id: dbId,
  filename: dbId,
  loaded: true,
  exports: {
    query: async () => {
      throw new Error('shared pool must not be used by the transaction path');
    },
    transaction: async () => {
      throw new Error('shared pool must not be used by the transaction path');
    },
  },
};

const STUDENT = '00000000-0000-4000-8000-000000000701';
const OTHER = '00000000-0000-4000-8000-000000000702';
const TEACHER = '00000000-0000-4000-8000-000000000801';
const ASSIGNMENT = '00000000-0000-4000-8000-000000000402';
const SCHEMA = `mx_phase_f_${process.pid}_${Date.now()}`;

const SCHEMA_SQL = `
  CREATE SCHEMA ${SCHEMA};
  SET search_path TO ${SCHEMA}, public;
  CREATE TABLE users (id UUID PRIMARY KEY, role TEXT, locale TEXT, is_active BOOLEAN DEFAULT TRUE, deleted_at TIMESTAMPTZ);
  CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL CHECK (title <> 'boom'),
    body TEXT, type VARCHAR(50), is_read BOOLEAN DEFAULT FALSE, meta JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    category TEXT, priority TEXT NOT NULL DEFAULT 'NORMAL', related_entity_type TEXT, related_entity_id UUID,
    actor_user_id UUID, provider_workspace_id UUID, group_id UUID, read_at TIMESTAMPTZ,
    email_status TEXT, email_sent_at TIMESTAMPTZ, dedupe_key TEXT
  );
  CREATE UNIQUE INDEX uq_notifications_user_dedupe ON notifications (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL;
  CREATE TABLE notification_preferences (user_id UUID, category TEXT, event_type TEXT, channel TEXT, enabled BOOLEAN, frequency TEXT);
  CREATE TABLE notification_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel TEXT NOT NULL, event_type TEXT NOT NULL, unique_key TEXT NOT NULL,
    user_id UUID, instructor_id UUID, to_addr TEXT, subject TEXT, body TEXT, context JSONB,
    status TEXT NOT NULL DEFAULT 'pending', retry_count INTEGER NOT NULL DEFAULT 0,
    next_retry_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), last_error TEXT, sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notification_id UUID REFERENCES notifications(id) ON DELETE SET NULL,
    template_key TEXT, locale VARCHAR(8), failed_at TIMESTAMPTZ
  );
  CREATE UNIQUE INDEX notification_queue_unique_key ON notification_queue (unique_key);
  INSERT INTO users (id, role, locale) VALUES
    ('${STUDENT}', 'student', 'en'), ('${OTHER}', 'student', 'az'), ('${TEACHER}', 'instructor', 'az');
`;

let client = null;
const savedEnv = {};

test.before(async () => {
  if (skip) return;
  for (const k of ['EMAIL_ENABLED', 'EMAIL_DRY_RUN', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS']) {
    savedEnv[k] = process.env[k];
    delete process.env[k];
  }
  process.env.EMAIL_ENABLED = 'true';
  const { Client } = require('pg');
  client = new Client({ connectionString: url });
  await client.connect();
  await client.query(SCHEMA_SQL);
});

test.after(async () => {
  if (!client) return;
  try {
    await client.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
  } finally {
    await client.end();
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});

async function counts() {
  const n = await client.query('SELECT COUNT(*)::int AS c FROM notifications');
  const q = await client.query('SELECT COUNT(*)::int AS c FROM notification_queue');
  return { notifications: n.rows[0].c, outbox: q.rows[0].c };
}

async function truncate() {
  await client.query('TRUNCATE notification_queue, notifications');
}

function reminder(recipientId, batch) {
  return {
    recipientId,
    instructorId: TEACHER,
    entityType: 'assignment',
    entityId: ASSIGNMENT,
    type: 'assignment_reminder',
    title: 'Reminder',
    body: 'Please submit «Faiz».',
    meta: { assignment_id: ASSIGNMENT },
    dedupeKey: `reminder:assignment:${ASSIGNMENT}:${batch}`,
    savepoint: `reminder_${recipientId.slice(-3)}`,
  };
}

test('rolled-back reminder leaves neither a notification nor an email', { skip }, async () => {
  await truncate();
  const { deliverReminderNotification } = require('./reminderDelivery');
  await client.query('BEGIN');
  const out = await deliverReminderNotification(client, reminder(STUDENT, 'b1'));
  assert.equal(out.status, 'delivered');
  assert.equal(out.emailQueued, true);
  const inside = await counts();
  assert.deepEqual(inside, { notifications: 1, outbox: 1 }, 'visible inside the transaction');
  await client.query('ROLLBACK');
  assert.deepEqual(await counts(), { notifications: 0, outbox: 0 });
});

test('committed reminder leaves exactly one notification and one outbox email', { skip }, async () => {
  await truncate();
  const { deliverReminderNotification } = require('./reminderDelivery');
  await client.query('BEGIN');
  const out = await deliverReminderNotification(client, reminder(STUDENT, 'b2'));
  await client.query('COMMIT');
  assert.deepEqual(await counts(), { notifications: 1, outbox: 1 });
  const { rows } = await client.query('SELECT unique_key, notification_id, template_key, locale FROM notification_queue');
  assert.deepEqual(rows[0], {
    unique_key: `email:notification:${out.notificationId}`,
    notification_id: out.notificationId,
    template_key: 'assignment_reminder',
    locale: 'en',
  });
  const { rows: n } = await client.query('SELECT category, email_status, related_entity_type, dedupe_key, meta FROM notifications');
  assert.deepEqual([n[0].category, n[0].email_status, n[0].related_entity_type], ['assignment', 'queued', 'assignment']);
  assert.equal(n[0].meta.reminder_kind, 'manual');
});

test('a failed delivery rolls back only its savepoint; the transaction stays usable', { skip }, async () => {
  await truncate();
  const { deliverReminderNotification } = require('./reminderDelivery');
  await client.query('BEGIN');
  const bad = await deliverReminderNotification(client, { ...reminder(OTHER, 'b3'), title: 'boom' });
  assert.equal(bad.status, 'failed');
  assert.equal(bad.errorCode, '23514', 'check_violation surfaced as the error code');
  const good = await deliverReminderNotification(client, reminder(STUDENT, 'b3'));
  assert.equal(good.status, 'delivered');
  await client.query('COMMIT');
  assert.deepEqual(await counts(), { notifications: 1, outbox: 1 });
});

test('retry inside a new transaction with the same dedupe key creates nothing new', { skip }, async () => {
  await truncate();
  const { createNotificationInTransaction } = require('./notificationService');
  const input = { recipientId: STUDENT, category: 'assignment', eventType: 'assignment_returned', params: { assignmentTitle: 'Faiz' }, dedupeKey: 'assignment_returned:x:1', email: true };
  await client.query('BEGIN');
  const a = await createNotificationInTransaction(client, input);
  await client.query('COMMIT');
  await client.query('BEGIN');
  const b = await createNotificationInTransaction(client, input);
  await client.query('COMMIT');
  assert.deepEqual([a.created, b.created, b.deduped], [true, false, true]);
  assert.deepEqual(await counts(), { notifications: 1, outbox: 1 });
});
