-- MANUAL rollback for migration 237_role_access_invites_live_topics.sql.
-- This folder is NOT read by scripts/migrate.js. Never copy this file into src/models/migrations/.
--
-- Run only after the application code that reads these tables has been rolled back.
-- DATA LOSS WARNING: drops role requests, invite tokens, the invite join log, lesson topics and
-- post-lesson follow-ups. Export first if needed:
--   \copy (SELECT * FROM role_requests) TO 'role_requests.csv' CSV HEADER
--   \copy (SELECT * FROM group_invites) TO 'group_invites.csv' CSV HEADER
--   \copy (SELECT * FROM group_invite_redemptions) TO 'group_invite_redemptions.csv' CSV HEADER
--   \copy (SELECT * FROM live_lesson_followups) TO 'live_lesson_followups.csv' CSV HEADER
-- Roles already granted through approved requests stay in user_roles (they are ordinary grants).
--
-- Usage (non-production first):  psql "$DATABASE_URL" -f backend/scripts/sql/rollback/237_role_access_invites_live_topics.rollback.sql

BEGIN;

SET LOCAL lock_timeout = '10s';

DROP TABLE IF EXISTS live_lesson_followups;
ALTER TABLE live_rooms DROP COLUMN IF EXISTS topic;
DROP TABLE IF EXISTS group_invite_redemptions;
DROP TABLE IF EXISTS group_invites;
DROP TABLE IF EXISTS role_requests;

DO $$
BEGIN
  IF to_regclass('public.platform_feature_flags') IS NOT NULL THEN
    DELETE FROM platform_feature_flags WHERE key = 'access.teacher_role_approval.enabled';
  END IF;
END $$;

-- auth_events: role_request* rows are kept; the old CHECK is re-added NOT VALID so they don't block it.
DO $$
BEGIN
  IF to_regclass('public.auth_events') IS NOT NULL THEN
    ALTER TABLE auth_events DROP CONSTRAINT IF EXISTS auth_events_event_check;
    ALTER TABLE auth_events
      ADD CONSTRAINT auth_events_event_check
      CHECK (event IN ('google_sign_in', 'google_sign_up', 'account_link_offered', 'account_linked',
                       'account_link_declined', 'login_failed', 'legacy_login_blocked', 'account_switch')) NOT VALID;
  END IF;
END $$;

DELETE FROM schema_migrations WHERE filename = '237_role_access_invites_live_topics.sql';

COMMIT;
