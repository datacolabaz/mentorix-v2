-- Rollback for 202_ai_credit_limits.sql (manual apply if needed).

BEGIN;

DROP TABLE IF EXISTS ai_usage_audit;

ALTER TABLE usage_counters
  DROP COLUMN IF EXISTS ai_questions_used,
  DROP COLUMN IF EXISTS ai_gradings_used,
  DROP COLUMN IF EXISTS ai_usage_period_key;

ALTER TABLE subscription_plans
  DROP COLUMN IF EXISTS ai_question_limit,
  DROP COLUMN IF EXISTS ai_grading_limit;

COMMIT;
