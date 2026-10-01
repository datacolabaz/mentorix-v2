const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

/**
 * Phase F guard: every notification goes through notificationService (dedupe, preferences,
 * category/priority, email outbox). No other source file may write the notifications table directly.
 */

const SRC = path.join(__dirname, '..');
const ALLOWED = new Set([path.join('services', 'notificationService.js')]);
const DIRECT_INSERT = /INSERT\s+INTO\s+(?:public\.)?"?notifications"?(?![\w"])/i;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (/\.(c|m)?js$/.test(entry.name) && !/\.test\.(c|m)?js$/.test(entry.name)) out.push(p);
  }
  return out;
}

test('only notificationService inserts into notifications', () => {
  const offenders = walk(SRC)
    .map((p) => path.relative(SRC, p))
    .filter((rel) => !ALLOWED.has(rel))
    .filter((rel) => DIRECT_INSERT.test(fs.readFileSync(path.join(SRC, rel), 'utf8')));
  assert.deepEqual(offenders, [], `direct INSERT INTO notifications outside notificationService: ${offenders.join(', ')}`);
});

test('the guard pattern catches the usual spellings and ignores sibling tables', () => {
  for (const sql of [
    'INSERT INTO notifications (user_id) VALUES ($1)',
    'insert into notifications(user_id) values ($1)',
    'INSERT INTO public.notifications (user_id)',
    'INSERT INTO "notifications" (user_id)',
    'INSERT INTO notifications\n  SELECT unnest($1::uuid[])',
  ]) {
    assert.match(sql, DIRECT_INSERT, sql);
  }
  for (const sql of ['INSERT INTO notification_queue (channel)', 'INSERT INTO notification_preferences (user_id)', 'INSERT INTO notifications_archive (id)']) {
    assert.doesNotMatch(sql, DIRECT_INSERT, sql);
  }
});

test('reminder delivery and activity hooks use the service, not SQL', () => {
  for (const rel of ['services/reminderDelivery.js', 'services/activityNotificationHooks.js', 'jobs/assignmentNotifications.js']) {
    const src = fs.readFileSync(path.join(SRC, rel), 'utf8');
    assert.match(src, /createNotification(Safe|InTransaction)?\s*\(/, rel);
  }
});
