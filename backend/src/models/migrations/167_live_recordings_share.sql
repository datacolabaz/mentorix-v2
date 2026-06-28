-- Live yazıları: paylaşım tokeni və yükləyən iştirakçı

BEGIN;

ALTER TABLE live_recordings
  ADD COLUMN IF NOT EXISTS uploaded_by_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE live_recordings
  ADD COLUMN IF NOT EXISTS share_token VARCHAR(64) UNIQUE;

CREATE INDEX IF NOT EXISTS idx_live_recordings_share_token
  ON live_recordings (share_token)
  WHERE share_token IS NOT NULL;

UPDATE live_recordings
SET share_token = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
WHERE share_token IS NULL;

COMMIT;
