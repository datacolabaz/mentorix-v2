BEGIN;

DROP INDEX IF EXISTS idx_live_rooms_provider;

ALTER TABLE live_rooms DROP CONSTRAINT IF EXISTS live_rooms_provider_check;

ALTER TABLE live_rooms
  DROP COLUMN IF EXISTS connection_id,
  DROP COLUMN IF EXISTS provider_payload,
  DROP COLUMN IF EXISTS passcode,
  DROP COLUMN IF EXISTS start_url,
  DROP COLUMN IF EXISTS join_url,
  DROP COLUMN IF EXISTS provider_meeting_id,
  DROP COLUMN IF EXISTS provider;

DROP TABLE IF EXISTS oauth_pending_states;
DROP TABLE IF EXISTS teacher_provider_connections;

COMMIT;
