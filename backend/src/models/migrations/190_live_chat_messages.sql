-- Persist in-call chat so late joiners see prior files and messages.

BEGIN;

CREATE TABLE IF NOT EXISTS live_chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES live_rooms(id) ON DELETE CASCADE,
  body VARCHAR(240) NOT NULL DEFAULT '',
  sender_name VARCHAR(255) NOT NULL,
  uploaded_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  guest_participant_id UUID REFERENCES live_guest_participants(id) ON DELETE SET NULL,
  attachment_id UUID REFERENCES live_chat_attachments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_chat_messages_room
  ON live_chat_messages (room_id, created_at ASC);

COMMIT;
