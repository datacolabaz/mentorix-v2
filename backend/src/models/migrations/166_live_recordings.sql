-- Mentorix Live: dərs yazıları (live_rooms-a toxunmadan ayrı cədvəl)

BEGIN;

CREATE TABLE IF NOT EXISTS live_recordings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL UNIQUE REFERENCES live_rooms(id) ON DELETE CASCADE,
  instructor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  content_type VARCHAR(100) NOT NULL DEFAULT 'video/webm',
  byte_size BIGINT NOT NULL DEFAULT 0,
  duration_sec INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_recordings_instructor ON live_recordings (instructor_id, created_at DESC);

COMMIT;
