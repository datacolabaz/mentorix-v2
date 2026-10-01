const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const { isUpMigrationFile, listUpMigrations, MIGRATIONS_DIR } = require('./migrate');

test('down/rollback files are never treated as up migrations', () => {
  assert.equal(isUpMigrationFile('202_ai_credit_limits.down.sql'), false);
  assert.equal(isUpMigrationFile('203_live_lesson_providers.down.sql'), false);
  assert.equal(isUpMigrationFile('214_notifications_extend.rollback.sql'), false);
});

test('files outside the NNN_name.sql pattern are skipped', () => {
  for (const name of ['README.md', 'notes.sql', '_draft.sql', '214_x.sql.bak', '21_short.sql', '214 space.sql', '.gitkeep']) {
    assert.equal(isUpMigrationFile(name), false, name);
  }
});

test('regular up migrations are accepted', () => {
  for (const name of ['002_init.sql', '113_notifications_meta.sql', '214_notifications_extend.sql', '1000_future.sql', '196_partner-referral.sql']) {
    assert.equal(isUpMigrationFile(name), true, name);
  }
});

test('listUpMigrations filters and sorts lexicographically', () => {
  const out = listUpMigrations([
    '215_notification_preferences.sql',
    '203_live_lesson_providers.down.sql',
    '203_live_lesson_providers.sql',
    'README.md',
    '214_notifications_extend.sql',
  ]);
  assert.deepEqual(out, [
    '203_live_lesson_providers.sql',
    '214_notifications_extend.sql',
    '215_notification_preferences.sql',
  ]);
});

test('real migrations folder: only the known *.down.sql files are excluded', () => {
  const all = fs.readdirSync(MIGRATIONS_DIR);
  const up = new Set(listUpMigrations(all));
  const excluded = all.filter((f) => !up.has(f)).sort();
  assert.ok(excluded.every((f) => f.endsWith('.down.sql')), `unexpected exclusions: ${excluded.join(', ')}`);
  assert.ok(up.has('214_notifications_extend.sql'));
  assert.ok(up.has('215_notification_preferences.sql'));
});
