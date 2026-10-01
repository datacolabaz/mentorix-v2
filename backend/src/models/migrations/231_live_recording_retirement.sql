-- Retired internal-video recordings: each teacher is notified (email + in-app) once; a recording may be
-- deleted only 30 days after that notice, and only when LIVE_RECORDING_PURGE_ENABLED=true (default:
-- dry run that logs candidates). This column records when the notice covering the recording went out.
-- Rollback (manual): backend/scripts/sql/rollback/231_live_recording_retirement.rollback.sql

SET LOCAL lock_timeout = '10s';

ALTER TABLE live_recordings ADD COLUMN IF NOT EXISTS retirement_notice_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_live_recordings_retirement_pending
  ON live_recordings (instructor_id)
  WHERE deleted_at IS NULL AND retirement_notice_sent_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_live_recordings_retirement_noticed
  ON live_recordings (retirement_notice_sent_at)
  WHERE deleted_at IS NULL AND retirement_notice_sent_at IS NOT NULL;

COMMENT ON COLUMN live_recordings.retirement_notice_sent_at IS
  'When the teacher was notified that this retired-video recording will be deleted 30 days later.';
