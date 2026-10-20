-- MANUAL rollback for migration 240_organization_requests_workspaces.sql. Not read by scripts/migrate.js.
-- Run only after the application code that reads these objects has been rolled back.
-- DATA LOSS WARNING: drops organization requests and each user's active organization choice. Organizations
-- created by approved requests, and the owner memberships added by the backfill, are kept (they are ordinary
-- organization rows; removing them would lock owners out). Export first if needed:
--   \copy (SELECT * FROM organization_requests) TO 'organization_requests.csv' CSV HEADER
--
-- Usage (non-production first):  psql "$DATABASE_URL" -f backend/scripts/sql/rollback/240_organization_requests_workspaces.rollback.sql

BEGIN;

SET LOCAL lock_timeout = '10s';

DROP TABLE IF EXISTS organization_requests;
ALTER TABLE users DROP COLUMN IF EXISTS active_organization_id;

DO $$
BEGIN
  IF to_regclass('auth_events') IS NOT NULL THEN
    ALTER TABLE auth_events DROP CONSTRAINT IF EXISTS auth_events_event_check;
    ALTER TABLE auth_events
      ADD CONSTRAINT auth_events_event_check
      CHECK (event IN ('google_sign_in', 'google_sign_up', 'account_link_offered', 'account_linked',
                       'account_link_declined', 'login_failed', 'legacy_login_blocked', 'account_switch',
                       'role_request', 'role_request_approved', 'role_request_rejected')) NOT VALID;
  END IF;
END $$;

DELETE FROM schema_migrations WHERE filename = '240_organization_requests_workspaces.sql';

COMMIT;
