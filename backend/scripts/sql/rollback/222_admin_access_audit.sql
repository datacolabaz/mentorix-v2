-- MANUAL rollback for 222_admin_access_audit.sql. Never place this file in src/models/migrations.
-- Run only after the Phase C code is reverted: while the code is live, admin activity reads fail closed (503)
-- without this table. Dropping it deletes the admin access audit trail; export it first if it must be kept:
--   \copy admin_access_audit TO 'admin_access_audit_backup.csv' CSV HEADER
BEGIN;

DROP INDEX IF EXISTS idx_admin_access_audit_target;
DROP INDEX IF EXISTS idx_admin_access_audit_actor;
DROP TABLE IF EXISTS admin_access_audit;

DELETE FROM schema_migrations WHERE filename = '222_admin_access_audit.sql';

COMMIT;
