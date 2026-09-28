const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const dbPath = path.join(__dirname, '../utils/db.js');
let flagRows = [];
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    query: async (sql) => {
      if (/FROM platform_feature_flags/.test(sql)) return { rows: flagRows };
      throw new Error(`unexpected query: ${sql}`);
    },
    transaction: async () => {
      throw new Error('not used');
    },
  },
};

const { requireFeature } = require('./requireFeature');
const { invalidateFeatureFlagCache } = require('../services/featureFlagService');
const { FEATURE_FLAGS } = require('../constants/featureFlags');

function run(mw, req = {}) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        resolve({ nextCalled: false, status: this.statusCode, body });
      },
    };
    mw({ headers: {}, ...req }, res, () => resolve({ nextCalled: true }));
  });
}

test('flag OFF: 404 FEATURE_DISABLED', async () => {
  flagRows = [{ key: FEATURE_FLAGS.MARKETPLACE, enabled: false }];
  invalidateFeatureFlagCache();
  const out = await run(requireFeature(FEATURE_FLAGS.MARKETPLACE));
  assert.equal(out.nextCalled, false);
  assert.equal(out.status, 404);
  assert.equal(out.body.code, 'FEATURE_DISABLED');
  assert.equal(out.body.message, 'Bu funksiya hazırda aktiv deyil');
});

test('flag ON: request passes', async () => {
  flagRows = [{ key: FEATURE_FLAGS.MARKETPLACE, enabled: true }];
  invalidateFeatureFlagCache();
  const out = await run(requireFeature(FEATURE_FLAGS.MARKETPLACE));
  assert.equal(out.nextCalled, true);
});

test('flag OFF: admin already authenticated passes', async () => {
  flagRows = [];
  invalidateFeatureFlagCache();
  const out = await run(requireFeature(FEATURE_FLAGS.MENTOR_SERVICES), { user: { id: 'a', role: 'admin' } });
  assert.equal(out.nextCalled, true);
});

test('flag OFF: non-admin authenticated user is blocked', async () => {
  flagRows = [];
  invalidateFeatureFlagCache();
  const out = await run(requireFeature(FEATURE_FLAGS.MENTOR_SERVICES), { user: { id: 's', role: 'student' } });
  assert.equal(out.status, 404);
});

test('missing row falls back to default (exam result modes ON, modules OFF)', async () => {
  flagRows = [];
  invalidateFeatureFlagCache();
  assert.equal((await run(requireFeature(FEATURE_FLAGS.EXAM_RESULT_MODES))).nextCalled, true);
  assert.equal((await run(requireFeature(FEATURE_FLAGS.UNIVERSITY_SEARCH))).status, 404);
  assert.equal((await run(requireFeature(FEATURE_FLAGS.PROCTORING))).status, 404);
});
