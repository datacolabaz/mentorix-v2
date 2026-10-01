-- MANUAL rollback for migration 230_sms_topup_decisions.sql.
-- This folder is NOT read by scripts/migrate.js. Never copy this file into src/models/migrations/.
-- WARNING: dropping billing_credits loses converted SMS credit balances. Export them first:
--   SELECT * FROM billing_credits; SELECT * FROM billing_credit_applications;
-- Payments already marked 'refunded' / 'credited' keep that status (admin_note holds the reason).
--
-- Usage (non-production first):  psql "$DATABASE_URL" -f backend/scripts/sql/rollback/230_sms_topup_decisions.rollback.sql

BEGIN;

SET LOCAL lock_timeout = '10s';

DROP TABLE IF EXISTS billing_credit_applications;
DROP TABLE IF EXISTS billing_credits;
ALTER TABLE billing_payments DROP COLUMN IF EXISTS credit_applied_cents;

DELETE FROM schema_migrations WHERE filename = '230_sms_topup_decisions.sql';

COMMIT;
