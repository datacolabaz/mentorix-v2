const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const dbPath = path.join(__dirname, '../utils/db.js');
const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const N_OWN = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

/** Minimal in-memory table that honours `id = $1 AND user_id = $2`. */
const rows = [
  { id: N_OWN, user_id: OWNER, is_read: false },
  { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', user_id: OTHER, is_read: false },
];
const calls = [];

require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    query: async (sql, params = []) => {
      calls.push({ sql, params });
      if (/^\s*UPDATE notifications\s+SET is_read = TRUE, read_at = COALESCE\(read_at, NOW\(\)\)\s+WHERE id = \$1 AND user_id = \$2/.test(sql)) {
        const hit = rows.find((r) => r.id === params[0] && r.user_id === params[1]);
        if (hit) hit.is_read = true;
        return { rowCount: hit ? 1 : 0 };
      }
      if (/WHERE n\.id = \$1 AND n\.user_id = \$2/.test(sql)) {
        const hit = rows.find((r) => r.id === params[0] && r.user_id === params[1]);
        return { rows: hit ? [hit] : [] };
      }
      if (/COUNT\(\*\)::int AS n FROM notifications WHERE user_id = \$1 AND is_read = FALSE/.test(sql)) {
        return { rows: [{ n: rows.filter((r) => r.user_id === params[0] && !r.is_read).length }] };
      }
      if (/FROM notifications n/.test(sql) && /ORDER BY n\.created_at DESC, n\.id DESC/.test(sql)) {
        return {
          rows: [
            {
              id: N_OWN,
              user_id: params[0],
              title: 'Yeni qoşulma sorğusu',
              body: 'b',
              type: 'join_request',
              is_read: false,
              meta: { i18n: { key: 'join_request', params: { studentName: 'A', groupName: 'G' } }, secret: 'x' },
              category: null,
              priority: 'NORMAL',
              created_at: new Date('2026-09-29T17:34:00Z'),
              cursor_ts: '2026-09-29T17:34:00.123456',
            },
          ],
        };
      }
      if (/^\s*UPDATE notifications n/.test(sql)) return { rowCount: 3 };
      throw new Error(`unexpected query: ${sql}`);
    },
    transaction: async () => {
      throw new Error('not used');
    },
  },
};

const center = require('./notificationCenterService');

test('mark read only affects the caller’s own rows', async () => {
  assert.equal(await center.markRead(OTHER, N_OWN), false);
  assert.equal(rows[0].is_read, false);
  assert.equal(await center.markRead(OWNER, N_OWN), true);
  assert.equal(rows[0].is_read, true);
  assert.equal(await center.markRead(OWNER, 'not-a-uuid'), false);
});

test('opening another user’s notification id returns nothing', async () => {
  assert.equal(await center.getOwnNotification(OTHER, N_OWN), null);
  assert.ok(await center.getOwnNotification(OWNER, N_OWN));
});

test('unread count is scoped to the caller', async () => {
  rows[1].is_read = false;
  assert.equal(await center.countUnread(OWNER), 0);
  assert.equal(await center.countUnread(OTHER), 1);
});

test('list: scoped by user_id, hides silent rows, maps legacy type → category, no raw meta leak', async () => {
  calls.length = 0;
  const out = await center.listNotifications(OWNER, { limit: 20 });
  const q = calls[0];
  assert.equal(q.params[0], OWNER);
  assert.match(q.sql, /n\.user_id = \$1/);
  assert.match(q.sql, /NOT \(n\.meta @> '\{"silent": true\}'::jsonb\)/);
  const n = out.notifications[0];
  assert.equal(n.category, 'group');
  assert.equal(n.priority, 'HIGH');
  assert.equal(n.event_type, 'join_request');
  assert.equal(n.recipient_user_id, OWNER);
  assert.deepEqual(n.i18n, { key: 'join_request', params: { studentName: 'A', groupName: 'G' } });
  assert.equal('meta' in n, false);
  assert.equal(n.has_link, true);
  assert.equal(out.next_cursor, null);
});

test('list: category + unread filters and cursor are parameterised', async () => {
  calls.length = 0;
  const cursor = center.encodeCursor({ cursor_ts: '2026-09-29T17:34:00.123456', id: N_OWN });
  await center.listNotifications(OWNER, { category: 'assignment', unread: true, cursor, limit: 5 });
  const q = calls[0];
  assert.match(q.sql, /n\.category = \$2 OR \(n\.category IS NULL AND/);
  assert.match(q.sql, /n\.is_read = FALSE/);
  assert.match(q.sql, /\(n\.created_at, n\.id\) < \(\$\d+::timestamp, \$\d+::uuid\)/);
  assert.ok(q.params.includes('assignment'));
  assert.ok(q.params.includes(N_OWN));
  assert.equal(q.params[q.params.length - 1], 6, 'limit + 1 to detect the next page');
});

test('list: bad category / cursor are rejected with 400', async () => {
  await assert.rejects(() => center.listNotifications(OWNER, { category: 'nope' }), (e) => e.statusCode === 400);
  await assert.rejects(() => center.listNotifications(OWNER, { cursor: 'garbage' }), (e) => e.statusCode === 400);
  const evil = Buffer.from(JSON.stringify({ t: "2026-01-01'; DROP TABLE x;--", id: N_OWN })).toString('base64url');
  assert.equal(center.decodeCursor(evil), null);
});

test('read-all is scoped to the caller', async () => {
  calls.length = 0;
  const n = await center.markAllRead(OWNER, { category: 'group' });
  assert.equal(n, 3);
  assert.equal(calls[0].params[0], OWNER);
  assert.match(calls[0].sql, /n\.user_id = \$1 AND n\.is_read = FALSE/);
});
