-- MANUAL rollback for migration 233_certificate_revocation.sql.
-- This folder is NOT read by scripts/migrate.js. Never copy this file into src/models/migrations/.
-- Certificates already revoked keep status = 'revoked' (allowed since migration 169); only the
-- revoke date / admin / reason columns are dropped. admin_access_audit keeps the history.
-- Deploy the previous backend first: the current code reads these columns.
--
-- Usage (non-production first):  psql "$DATABASE_URL" -f backend/scripts/sql/rollback/233_certificate_revocation.rollback.sql

BEGIN;

SET LOCAL lock_timeout = '10s';

DROP INDEX IF EXISTS idx_certificates_revoked;
ALTER TABLE certificates DROP CONSTRAINT IF EXISTS certificates_revoke_reason_len_chk;
ALTER TABLE certificates DROP COLUMN IF EXISTS revoke_reason;
ALTER TABLE certificates DROP COLUMN IF EXISTS revoked_by;
ALTER TABLE certificates DROP COLUMN IF EXISTS revoked_at;

DELETE FROM schema_migrations WHERE filename = '233_certificate_revocation.sql';

COMMIT;
