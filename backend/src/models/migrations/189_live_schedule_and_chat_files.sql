-- Scheduled live rooms + in-call chat file attachments.

BEGIN;

ALTER TABLE live_rooms
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_live_rooms_scheduled
  ON live_rooms (instructor_id, scheduled_at DESC)
  WHERE scheduled_at IS NOT NULL AND ended_at IS NULL;

CREATE TABLE IF NOT EXISTS live_chat_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES live_rooms(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL UNIQUE,
  original_name VARCHAR(255) NOT NULL,
  content_type VARCHAR(80) NOT NULL,
  byte_size INTEGER NOT NULL,
  uploaded_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  guest_participant_id UUID REFERENCES live_guest_participants(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_chat_attachments_room
  ON live_chat_attachments (room_id, created_at DESC);

COMMIT;
