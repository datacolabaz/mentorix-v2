const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');

/**
 * Integration-style unit tests for reserve/release semantics with an in-memory fake pool.
 * Covers: increment on success, no consume on fail, concurrent race, trial vs monthly period.
 */

function createFakeDb() {
  /** @type {Map<string, { ai_questions_used: number, ai_gradings_used: number, ai_usage_period_key: string|null }>} */
  const rows = new Map();
  let lockHeld = false;

  const client = {
    async query(sql, params = []) {
      const q = String(sql).replace(/\s+/g, ' ').trim();

      if (q === 'BEGIN' || q === 'COMMIT' || q === 'ROLLBACK') {
        if (q === 'BEGIN') lockHeld = true;
        if (q === 'COMMIT' || q === 'ROLLBACK') lockHeld = false;
        return { rows: [] };
      }

      if (q.includes('to_char') && q.includes('YYYY-MM')) {
        return { rows: [{ ym: '2026-09' }] };
      }

      if (q.startsWith('INSERT INTO usage_counters')) {
        const userId = params[0];
        const periodKey = params[1];
        if (!rows.has(userId)) {
          rows.set(userId, {
            ai_questions_used: 0,
            ai_gradings_used: 0,
            ai_usage_period_key: periodKey,
          });
        }
        return { rows: [] };
      }

      if (q.includes('FROM usage_counters WHERE user_id') && q.includes('FOR UPDATE')) {
        const userId = params[0];
        const row = rows.get(userId) || {
          ai_questions_used: 0,
          ai_gradings_used: 0,
          ai_usage_period_key: null,
        };
        return { rows: [{ ...row }] };
      }

      if (q.includes('SET ai_questions_used = 0') && q.includes('ai_gradings_used = 0')) {
        const userId = params[0];
        const periodKey = params[1];
        const next = {
          ai_questions_used: 0,
          ai_gradings_used: 0,
          ai_usage_period_key: periodKey,
        };
        rows.set(userId, next);
        return { rows: [{ ...next }] };
      }

      if (q.includes('SET ai_questions_used = ai_questions_used +') || q.includes('SET ai_gradings_used = ai_gradings_used +')) {
        const userId = params[0];
        const amount = Number(params[1]) || 1;
        const limit = params.length > 2 ? Number(params[2]) : null;
        const isQ = q.includes('ai_questions_used = ai_questions_used +');
        const row = rows.get(userId) || {
          ai_questions_used: 0,
          ai_gradings_used: 0,
          ai_usage_period_key: '2026-09',
        };
        const col = isQ ? 'ai_questions_used' : 'ai_gradings_used';
        if (limit != null && Number.isFinite(limit) && row[col] + amount > limit) {
          return { rows: [] };
        }
        row[col] = row[col] + amount;
        rows.set(userId, row);
        return { rows: [{ ...row }] };
      }

      if (q.includes('GREATEST(0,')) {
        const userId = params[0];
        const amount = Number(params[1]) || 1;
        const isQ = q.includes('ai_questions_used = GREATEST');
        const row = rows.get(userId);
        if (row) {
          const col = isQ ? 'ai_questions_used' : 'ai_gradings_used';
          row[col] = Math.max(0, row[col] - amount);
          rows.set(userId, row);
        }
        return { rows: [] };
      }

      if (q.includes('INSERT INTO ai_usage_audit')) {
        return { rows: [] };
      }

      throw new Error(`Unhandled SQL in fake db: ${q.slice(0, 120)}`);
    },
  };

  return {
    rows,
    lockHeld: () => lockHeld,
    pool: {
      connect: async () => ({
        query: client.query.bind(client),
        release() {},
      }),
    },
    query: client.query.bind(client),
  };
}

describe('aiCreditService reserve/release (fake db)', () => {
  let restoreDb;
  let restorePlans;
  let restoreGetPlan;
  let fake;

  beforeEach(() => {
    fake = createFakeDb();
    const dbPath = require.resolve('../utils/db');
    const plansPath = require.resolve('../services/subscriptionPlansService');
    const getPlanPath = require.resolve('../services/billingGetCurrentPlan');
    const creditPath = require.resolve('../services/aiCreditService');

    // Fresh module load each test
    delete require.cache[creditPath];
    delete require.cache[dbPath];
    delete require.cache[plansPath];
    delete require.cache[getPlanPath];

    const db = require('../utils/db');
    restoreDb = {
      pool: db.pool,
      query: db.query,
    };
    db.pool = fake.pool;
    db.query = fake.query;

    const plansSvc = require('../services/subscriptionPlansService');
    restorePlans = plansSvc.getActivePlansMap;
    plansSvc.getActivePlansMap = async () => ({
      basic: {
        limits: { ai_questions_monthly: 20, ai_gradings_monthly: 10 },
      },
      pro: {
        limits: { ai_questions_monthly: 100, ai_gradings_monthly: 30 },
      },
    });

    const getCurrentPlan = require('../services/billingGetCurrentPlan');
    // billingGetCurrentPlan is module.exports = async function
  });

  afterEach(() => {
    const db = require('../utils/db');
    if (restoreDb) {
      db.pool = restoreDb.pool;
      db.query = restoreDb.query;
    }
    const plansSvc = require('../services/subscriptionPlansService');
    if (restorePlans) plansSvc.getActivePlansMap = restorePlans;
    delete require.cache[require.resolve('../services/aiCreditService')];
  });

  it('increments on success and releases on failure', async () => {
    // Patch getCurrentPlan via rewriting require in aiCreditService — inject by stubbing module
    const Module = require('module');
    const originalLoad = Module._load;
    Module._load = function (request, parent, isMain) {
      if (request.endsWith('billingGetCurrentPlan') || request === './billingGetCurrentPlan') {
        return async () => ({ plan: 'pro', status: 'active' });
      }
      return originalLoad.apply(this, arguments);
    };

    try {
      delete require.cache[require.resolve('../services/aiCreditService')];
      const {
        withAiCredit,
        getAiUsageSnapshot,
        AI_OPS,
      } = require('../services/aiCreditService');

      const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

      const ok = await withAiCredit({
        userId,
        operation: AI_OPS.QUESTION_GENERATION,
        amount: 2,
        run: async () => ({ model: 'claude-haiku-4-5', tokenUsage: { prompt: 10, completion: 20 } }),
      });
      assert.equal(ok.model, 'claude-haiku-4-5');

      let snap = await getAiUsageSnapshot(userId);
      assert.equal(snap.usage.ai_questions_used, 2);

      await assert.rejects(
        () =>
          withAiCredit({
            userId,
            operation: AI_OPS.QUESTION_GENERATION,
            amount: 1,
            run: async () => {
              throw new Error('Anthropic boom');
            },
          }),
        /Anthropic boom/,
      );

      snap = await getAiUsageSnapshot(userId);
      assert.equal(snap.usage.ai_questions_used, 2, 'failure must not consume');
    } finally {
      Module._load = originalLoad;
      delete require.cache[require.resolve('../services/aiCreditService')];
    }
  });

  it('rejects when package limit exceeded (race-safe conditional update)', async () => {
    const Module = require('module');
    const originalLoad = Module._load;
    Module._load = function (request, parent, isMain) {
      if (request.endsWith('billingGetCurrentPlan') || request === './billingGetCurrentPlan') {
        return async () => ({ plan: 'basic', status: 'active' });
      }
      return originalLoad.apply(this, arguments);
    };

    try {
      delete require.cache[require.resolve('../services/aiCreditService')];
      const { reserveAiCredit, AI_OPS } = require('../services/aiCreditService');
      const userId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

      await reserveAiCredit(userId, AI_OPS.QUESTION_GENERATION, 20);
      await assert.rejects(
        () => reserveAiCredit(userId, AI_OPS.QUESTION_GENERATION, 1),
        (err) => err.code === 'AI_LIMIT_EXCEEDED',
      );
    } finally {
      Module._load = originalLoad;
      delete require.cache[require.resolve('../services/aiCreditService')];
    }
  });

  it('serializes concurrent reserves so only one wins last credit', async () => {
    const Module = require('module');
    const originalLoad = Module._load;
    Module._load = function (request, parent, isMain) {
      if (request.endsWith('billingGetCurrentPlan') || request === './billingGetCurrentPlan') {
        return async () => ({ plan: 'basic', status: 'active' });
      }
      return originalLoad.apply(this, arguments);
    };

    try {
      delete require.cache[require.resolve('../services/aiCreditService')];
      const { reserveAiCredit, getAiUsageSnapshot, AI_OPS } = require('../services/aiCreditService');
      const userId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

      await reserveAiCredit(userId, AI_OPS.ASSIGNMENT_GRADING, 9);

      const results = await Promise.allSettled([
        reserveAiCredit(userId, AI_OPS.ASSIGNMENT_GRADING, 1),
        reserveAiCredit(userId, AI_OPS.ASSIGNMENT_GRADING, 1),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');
      assert.equal(fulfilled.length, 1);
      assert.equal(rejected.length, 1);
      assert.equal(rejected[0].reason.code, 'AI_LIMIT_EXCEEDED');

      const snap = await getAiUsageSnapshot(userId);
      assert.equal(snap.usage.ai_gradings_used, 10);
      assert.equal(snap.period_key, 'trial');
    } finally {
      Module._load = originalLoad;
      delete require.cache[require.resolve('../services/aiCreditService')];
    }
  });
});
