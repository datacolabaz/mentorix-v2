/**
 * AI credit guard: check before Anthropic calls; reserve → release on failure; consume on success.
 * Race-safe via FOR UPDATE + conditional UPDATE.
 */

const db = require('../utils/db');
const getCurrentPlan = require('./billingGetCurrentPlan');
const { getActivePlansMap } = require('./subscriptionPlansService');
const { PLANS, normalizePlanSlug } = require('../config/plans');
const {
  aiLimitExceededMessage,
  estimateCostUsd,
  OPERATION,
} = require('../config/aiModels');
const {
  AI_OPS,
  resolveAiPeriodKey,
  limitForOperation,
  usedForOperation,
  canConsume,
  remainingCredits,
} = require('../lib/aiCreditMath');

const TZ = 'Asia/Baku';

function httpError(code, status, message) {
  const err = new Error(message || code);
  err.code = code;
  err.status = status;
  err.statusCode = status;
  return err;
}

async function currentYmBaku(client = db) {
  const { rows } = await client.query(
    `SELECT to_char((CURRENT_TIMESTAMP AT TIME ZONE '${TZ}'), 'YYYY-MM') AS ym`,
  );
  return rows[0]?.ym || new Date().toISOString().slice(0, 7);
}

function fallbackAiLimits(slug) {
  const p = PLANS[normalizePlanSlug(slug)] || PLANS.basic;
  return {
    ai_questions_monthly: p.ai_questions_monthly ?? null,
    ai_gradings_monthly: p.ai_gradings_monthly ?? null,
  };
}

async function getInstructorAiLimits(userId, client = db) {
  const sub = await getCurrentPlan(client, userId);
  const slug = normalizePlanSlug(sub?.plan || 'basic');
  let map = {};
  try {
    map = await getActivePlansMap();
  } catch {
    map = {};
  }
  const fromPlan = map[slug]?.limits || {};
  const fb = fallbackAiLimits(slug);
  return {
    plan: slug,
    subscription_status: sub?.status || 'active',
    is_trial: slug === 'basic',
    current_period_start: sub?.current_period_start || null,
    current_period_end: sub?.current_period_end || null,
    limits: {
      ai_questions_monthly:
        fromPlan.ai_questions_monthly != null
          ? Number(fromPlan.ai_questions_monthly)
          : fb.ai_questions_monthly,
      ai_gradings_monthly:
        fromPlan.ai_gradings_monthly != null
          ? Number(fromPlan.ai_gradings_monthly)
          : fb.ai_gradings_monthly,
    },
  };
}

async function ensureAiUsageRow(client, userId, periodKey) {
  await client.query(
    `INSERT INTO usage_counters (
       user_id, students_count, storage_used_mb, storage_used_bytes,
       sms_used_monthly, sms_period_ym, ai_questions_used, ai_gradings_used, ai_usage_period_key
     )
     VALUES ($1, 0, 0, 0, 0, to_char((CURRENT_TIMESTAMP AT TIME ZONE '${TZ}'), 'YYYY-MM'), 0, 0, $2)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId, periodKey],
  );

  const { rows } = await client.query(
    `SELECT ai_questions_used, ai_gradings_used, ai_usage_period_key
     FROM usage_counters WHERE user_id = $1 FOR UPDATE`,
    [userId],
  );
  let usage = rows[0] || {
    ai_questions_used: 0,
    ai_gradings_used: 0,
    ai_usage_period_key: periodKey,
  };

  if (String(usage.ai_usage_period_key || '') !== String(periodKey)) {
    const { rows: reset } = await client.query(
      `UPDATE usage_counters
       SET ai_questions_used = 0,
           ai_gradings_used = 0,
           ai_usage_period_key = $2,
           updated_at = NOW()
       WHERE user_id = $1
       RETURNING ai_questions_used, ai_gradings_used, ai_usage_period_key`,
      [userId, periodKey],
    );
    usage = reset[0] || {
      ai_questions_used: 0,
      ai_gradings_used: 0,
      ai_usage_period_key: periodKey,
    };
  }
  return usage;
}

/**
 * Snapshot for billing status / UI (no lock).
 */
async function getAiUsageSnapshot(userId) {
  const { plan, limits, is_trial, subscription_status } = await getInstructorAiLimits(userId);
  const ym = await currentYmBaku();
  const periodKey = resolveAiPeriodKey(plan, ym);

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const usage = await ensureAiUsageRow(client, userId, periodKey);
    await client.query('COMMIT');
    const qUsed = Math.max(0, Number(usage.ai_questions_used) || 0);
    const gUsed = Math.max(0, Number(usage.ai_gradings_used) || 0);
    return {
      plan,
      is_trial,
      subscription_status,
      period_key: periodKey,
      limits,
      usage: {
        ai_questions_used: qUsed,
        ai_gradings_used: gUsed,
      },
      remaining: {
        ai_questions: remainingCredits(limits.ai_questions_monthly, qUsed),
        ai_gradings: remainingCredits(limits.ai_gradings_monthly, gUsed),
      },
    };
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Soft check (no reservation). Throws AI_LIMIT_EXCEEDED when blocked.
 */
async function checkAiCredit(userId, operation, amount = 1, { locale } = {}) {
  const op = String(operation || '').toUpperCase();
  if (op !== AI_OPS.QUESTION_GENERATION && op !== AI_OPS.ASSIGNMENT_GRADING) {
    throw httpError('AI_OPERATION_INVALID', 400, 'AI_OPERATION_INVALID');
  }
  const n = Math.max(1, Math.floor(Number(amount) || 1));
  const snap = await getAiUsageSnapshot(userId);
  const lim = limitForOperation(snap.limits, op);
  const used = usedForOperation(snap.usage, op);
  if (!canConsume(lim, used, n)) {
    throw httpError(
      'AI_LIMIT_EXCEEDED',
      429,
      aiLimitExceededMessage(locale, { isTrial: snap.is_trial }),
    );
  }
  return { ...snap, operation: op, amount: n };
}

/**
 * Atomically reserve credits before the provider call.
 * On API failure call releaseAiCredit; on success credits stay consumed.
 */
async function reserveAiCredit(userId, operation, amount = 1, { locale } = {}) {
  const op = String(operation || '').toUpperCase();
  if (op !== AI_OPS.QUESTION_GENERATION && op !== AI_OPS.ASSIGNMENT_GRADING) {
    throw httpError('AI_OPERATION_INVALID', 400, 'AI_OPERATION_INVALID');
  }
  const n = Math.max(1, Math.floor(Number(amount) || 1));
  const { plan, limits, is_trial } = await getInstructorAiLimits(userId);
  const ym = await currentYmBaku();
  const periodKey = resolveAiPeriodKey(plan, ym);
  const lim = limitForOperation(limits, op);

  const col =
    op === AI_OPS.QUESTION_GENERATION ? 'ai_questions_used' : 'ai_gradings_used';

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await ensureAiUsageRow(client, userId, periodKey);

    let rows;
    if (lim == null || !Number.isFinite(Number(lim))) {
      const r = await client.query(
        `UPDATE usage_counters
         SET ${col} = ${col} + $2, updated_at = NOW()
         WHERE user_id = $1
         RETURNING ai_questions_used, ai_gradings_used, ai_usage_period_key`,
        [userId, n],
      );
      rows = r.rows;
    } else {
      const r = await client.query(
        `UPDATE usage_counters
         SET ${col} = ${col} + $2, updated_at = NOW()
         WHERE user_id = $1
           AND ${col} + $2 <= $3
         RETURNING ai_questions_used, ai_gradings_used, ai_usage_period_key`,
        [userId, n, Number(lim)],
      );
      rows = r.rows;
    }

    if (!rows[0]) {
      await client.query('ROLLBACK');
      throw httpError(
        'AI_LIMIT_EXCEEDED',
        429,
        aiLimitExceededMessage(locale, { isTrial: is_trial }),
      );
    }

    await client.query('COMMIT');
    return {
      plan,
      is_trial,
      period_key: periodKey,
      operation: op,
      amount: n,
      usage: {
        ai_questions_used: Number(rows[0].ai_questions_used) || 0,
        ai_gradings_used: Number(rows[0].ai_gradings_used) || 0,
      },
      limits,
    };
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Undo a reservation after provider failure (does not consume).
 */
async function releaseAiCredit(userId, operation, amount = 1) {
  const op = String(operation || '').toUpperCase();
  const n = Math.max(1, Math.floor(Number(amount) || 1));
  const col =
    op === AI_OPS.QUESTION_GENERATION ? 'ai_questions_used' : 'ai_gradings_used';
  await db.query(
    `UPDATE usage_counters
     SET ${col} = GREATEST(0, ${col} - $2), updated_at = NOW()
     WHERE user_id = $1`,
    [userId, n],
  );
}

/**
 * Success path after reserve — optional audit only (credits already incremented).
 */
async function confirmAiCredit(userId, meta = {}) {
  const {
    operation,
    model,
    request_id,
    tokens_in,
    tokens_out,
    tokenUsage,
  } = meta;
  const prompt = Number(tokens_in ?? tokenUsage?.prompt ?? 0) || 0;
  const completion = Number(tokens_out ?? tokenUsage?.completion ?? 0) || 0;
  const estimated =
    estimateCostUsd(model, { prompt, completion }) ??
    null;
  try {
    await db.query(
      `INSERT INTO ai_usage_audit
         (user_id, operation_type, model, request_id, tokens_in, tokens_out, estimated_cost_usd)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        userId,
        String(operation || '').slice(0, 64),
        model ? String(model).slice(0, 128) : null,
        request_id ? String(request_id).slice(0, 128) : null,
        prompt || null,
        completion || null,
        estimated,
      ],
    );
  } catch {
    // audit is best-effort (migration may lag)
  }
}

/**
 * Run an async AI work function with reserve/release/confirm semantics.
 * @template T
 * @param {Object} opts
 * @param {string} opts.userId
 * @param {string} opts.operation
 * @param {number} [opts.amount]
 * @param {string} [opts.locale]
 * @param {() => Promise<T & { model?: string, tokenUsage?: object, requestId?: string }>} opts.run
 * @returns {Promise<T>}
 */
async function withAiCredit({ userId, operation, amount = 1, locale, run }) {
  const reserved = await reserveAiCredit(userId, operation, amount, { locale });
  try {
    const result = await run();
    await confirmAiCredit(userId, {
      operation,
      model: result?.model,
      request_id: result?.requestId || result?.request_id,
      tokenUsage: result?.tokenUsage,
      tokens_in: result?.tokens_in,
      tokens_out: result?.tokens_out,
    });
    return result;
  } catch (err) {
    try {
      await releaseAiCredit(userId, operation, amount);
    } catch {
      /* ignore release errors */
    }
    throw err;
  }
}

module.exports = {
  TZ,
  OPERATION,
  AI_OPS,
  getInstructorAiLimits,
  getAiUsageSnapshot,
  checkAiCredit,
  reserveAiCredit,
  releaseAiCredit,
  confirmAiCredit,
  withAiCredit,
  ensureAiUsageRow,
  currentYmBaku,
};
