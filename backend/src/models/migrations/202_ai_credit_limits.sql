-- AI question / grading credits per subscription plan + usage counters + audit log.
-- Rollback-friendly: columns/tables use IF NOT EXISTS; drop via 202_ai_credit_limits.down.sql if needed.

BEGIN;

ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS ai_question_limit INTEGER NULL,
  ADD COLUMN IF NOT EXISTS ai_grading_limit INTEGER NULL;

-- SADƏ / trial: whole-trial totals (not monthly)
UPDATE subscription_plans
SET ai_question_limit = 20,
    ai_grading_limit = 10,
    updated_at = NOW()
WHERE slug = 'basic';

-- STANDART
UPDATE subscription_plans
SET ai_question_limit = 100,
    ai_grading_limit = 30,
    updated_at = NOW()
WHERE slug = 'pro';

-- PROFESSİONAL
UPDATE subscription_plans
SET ai_question_limit = 300,
    ai_grading_limit = 100,
    updated_at = NOW()
WHERE slug = 'growth';

-- PREMİUM
UPDATE subscription_plans
SET ai_question_limit = 800,
    ai_grading_limit = 300,
    updated_at = NOW()
WHERE slug = 'premium';

ALTER TABLE usage_counters
  ADD COLUMN IF NOT EXISTS ai_questions_used INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_gradings_used INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_usage_period_key VARCHAR(64) NULL;

CREATE TABLE IF NOT EXISTS ai_usage_audit (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  operation_type VARCHAR(64) NOT NULL,
  model VARCHAR(128) NULL,
  request_id VARCHAR(128) NULL,
  tokens_in INTEGER NULL,
  tokens_out INTEGER NULL,
  estimated_cost_usd NUMERIC(12, 6) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_audit_user_created
  ON ai_usage_audit (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_audit_op_created
  ON ai_usage_audit (operation_type, created_at DESC);

COMMIT;
