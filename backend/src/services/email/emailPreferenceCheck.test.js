const test = require('node:test');
const assert = require('node:assert/strict');

const { checkEmailPreference } = require('./emailPreferenceCheck');

const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function client({ user = { id: USER, role: 'student', locale: 'en', is_active: true, deleted_at: null }, prefs = [], fail = null } = {}) {
  const calls = [];
  return {
    calls,
    query: async (sql, params) => {
      calls.push({ sql, params });
      if (fail) throw fail;
      if (/FROM users/.test(sql)) return { rows: user ? [user] : [] };
      if (/FROM notification_preferences/.test(sql)) return { rows: prefs };
      throw new Error(`unexpected ${sql}`);
    },
  };
}

test('role default keeps the email on and returns the user locale', async () => {
  const r = await checkEmailPreference({ userId: USER, category: 'assignment', eventType: 'assignment_new' }, { client: client() });
  assert.equal(r.allowed, true);
  assert.equal(r.locale, 'en');
});

test('category email turned off → not sent', async () => {
  const c = client({ prefs: [{ category: 'assignment', event_type: null, channel: 'email', enabled: false, frequency: 'off' }] });
  const r = await checkEmailPreference({ userId: USER, category: 'assignment', eventType: 'assignment_new' }, { client: c });
  assert.equal(r.allowed, false);
});

test('daily/weekly summary chosen → immediate email held back', async () => {
  const c = client({ prefs: [{ category: 'group', event_type: null, channel: 'email', enabled: true, frequency: 'weekly' }] });
  const r = await checkEmailPreference({ userId: USER, category: 'group', eventType: 'live_class_started' }, { client: c });
  assert.deepEqual([r.allowed, r.reason], [false, 'digest']);
});

test('inactive users get nothing; DB errors fail open (today\'s behaviour)', async () => {
  const inactive = await checkEmailPreference(
    { userId: USER, category: 'assignment', eventType: 'assignment_new' },
    { client: client({ user: { id: USER, role: 'student', locale: 'az', is_active: false, deleted_at: null } }) },
  );
  assert.equal(inactive.allowed, false);
  const orig = console.error;
  console.error = () => {};
  try {
    const r = await checkEmailPreference({ userId: USER, category: 'assignment', eventType: 'assignment_new' }, { client: client({ fail: new Error('db down') }) });
    assert.deepEqual([r.allowed, r.reason], [true, 'check_failed']);
  } finally {
    console.error = orig;
  }
});
