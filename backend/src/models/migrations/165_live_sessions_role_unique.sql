-- Mentorix Live: sessiya rolu və otaq+istifadəçi unikallığı

BEGIN;

ALTER TABLE live_sessions
  ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'student'
  CHECK (role IN ('instructor', 'student'));

DELETE FROM live_sessions a
USING live_sessions b
WHERE a.room_id = b.room_id
  AND a.user_id = b.user_id
  AND a.id < b.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_live_sessions_room_user
  ON live_sessions (room_id, user_id);

COMMIT;
