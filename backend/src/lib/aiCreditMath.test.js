const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  AI_OPS,
  resolveAiPeriodKey,
  limitForOperation,
  usedForOperation,
  canConsume,
  remainingCredits,
  isNearLimit,
} = require('./aiCreditMath');
const {
  resolveQuestionModel,
  resolveGradingModel,
  estimateCostUsd,
  aiLimitExceededMessage,
  DEFAULT_QUESTION_MODEL,
  DEFAULT_GRADING_MODEL,
} = require('../config/aiModels');

describe('aiCreditMath', () => {
  it('maps basic plan to trial period key', () => {
    assert.equal(resolveAiPeriodKey('basic', '2026-09'), 'trial');
    assert.equal(resolveAiPeriodKey('pro', '2026-09'), '2026-09');
    assert.equal(resolveAiPeriodKey('growth', '2026-01'), '2026-01');
    assert.equal(resolveAiPeriodKey('premium', '2026-12'), '2026-12');
  });

  it('resolves package limits for questions and gradings', () => {
    const trial = { ai_questions_monthly: 20, ai_gradings_monthly: 10 };
    const standart = { ai_questions_monthly: 100, ai_gradings_monthly: 30 };
    assert.equal(limitForOperation(trial, AI_OPS.QUESTION_GENERATION), 20);
    assert.equal(limitForOperation(trial, AI_OPS.ASSIGNMENT_GRADING), 10);
    assert.equal(limitForOperation(standart, AI_OPS.QUESTION_GENERATION), 100);
    assert.equal(limitForOperation(standart, AI_OPS.ASSIGNMENT_GRADING), 30);
  });

  it('blocks when exceeded and allows under limit', () => {
    assert.equal(canConsume(20, 19, 1), true);
    assert.equal(canConsume(20, 20, 1), false);
    assert.equal(canConsume(20, 18, 3), false);
    assert.equal(canConsume(null, 999, 1), true);
  });

  it('computes remaining and near-limit', () => {
    assert.equal(remainingCredits(100, 67), 33);
    assert.equal(remainingCredits(null, 10), null);
    assert.equal(isNearLimit(100, 85), true);
    assert.equal(isNearLimit(100, 50), false);
  });

  it('reads used counters by operation', () => {
    const u = { ai_questions_used: 7, ai_gradings_used: 3 };
    assert.equal(usedForOperation(u, AI_OPS.QUESTION_GENERATION), 7);
    assert.equal(usedForOperation(u, AI_OPS.ASSIGNMENT_GRADING), 3);
  });
});

describe('aiModels config', () => {
  it('defaults to current Haiku / Sonnet IDs', () => {
    delete process.env.AI_QUESTION_MODEL;
    delete process.env.ANTHROPIC_GENERATION_MODEL;
    delete process.env.AI_GRADING_MODEL;
    delete process.env.ANTHROPIC_OPEN_GRADING_MODEL;
    assert.equal(resolveQuestionModel(), DEFAULT_QUESTION_MODEL);
    assert.equal(resolveGradingModel(), DEFAULT_GRADING_MODEL);
    assert.equal(DEFAULT_QUESTION_MODEL, 'claude-haiku-4-5');
    assert.equal(DEFAULT_GRADING_MODEL, 'claude-sonnet-5');
  });

  it('honors AI_QUESTION_MODEL / AI_GRADING_MODEL env', () => {
    process.env.AI_QUESTION_MODEL = 'claude-haiku-4-5-20251001';
    process.env.AI_GRADING_MODEL = 'claude-sonnet-5';
    assert.equal(resolveQuestionModel(), 'claude-haiku-4-5-20251001');
    assert.equal(resolveGradingModel(), 'claude-sonnet-5');
    delete process.env.AI_QUESTION_MODEL;
    delete process.env.AI_GRADING_MODEL;
  });

  it('estimates cost and localizes limit messages', () => {
    const cost = estimateCostUsd('claude-haiku-4-5', { prompt: 1000, completion: 1000 });
    assert.ok(cost != null && cost > 0);
    assert.equal(aiLimitExceededMessage('az'), 'Aylıq AI limitiniz bitdi.');
    assert.match(aiLimitExceededMessage('en'), /monthly AI limit/i);
    assert.match(aiLimitExceededMessage('ru'), /лимит/i);
    assert.equal(aiLimitExceededMessage('az', { isTrial: true }), 'Sınaq AI limitiniz bitdi.');
  });
});

describe('plan AI fallbacks', () => {
  it('matches package table in config/plans', () => {
    const { PLANS } = require('../config/plans');
    assert.deepEqual(
      {
        basic: [PLANS.basic.ai_questions_monthly, PLANS.basic.ai_gradings_monthly],
        pro: [PLANS.pro.ai_questions_monthly, PLANS.pro.ai_gradings_monthly],
        growth: [PLANS.growth.ai_questions_monthly, PLANS.growth.ai_gradings_monthly],
        premium: [PLANS.premium.ai_questions_monthly, PLANS.premium.ai_gradings_monthly],
      },
      {
        basic: [20, 10],
        pro: [100, 30],
        growth: [300, 100],
        premium: [800, 300],
      },
    );
  });
});
