-- Canlı dərs + təqdimat sinxronu və slayd üzərində poll/quiz

BEGIN;

ALTER TABLE live_rooms
  ADD COLUMN IF NOT EXISTS presentation_id UUID NULL REFERENCES presentations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS presentation_slide INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS presentation_state JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_live_rooms_presentation
  ON live_rooms (presentation_id)
  WHERE presentation_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS presentation_polls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES live_rooms(id) ON DELETE CASCADE,
  presentation_id UUID NULL REFERENCES presentations(id) ON DELETE SET NULL,
  slide_index INT NOT NULL DEFAULT 0 CHECK (slide_index >= 0),
  question TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  kind TEXT NOT NULL DEFAULT 'poll' CHECK (kind IN ('poll', 'quiz')),
  correct_option_id TEXT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_presentation_polls_room
  ON presentation_polls (room_id, created_at DESC);

CREATE TABLE IF NOT EXISTS presentation_poll_responses (
  poll_id UUID NOT NULL REFERENCES presentation_polls(id) ON DELETE CASCADE,
  respondent_key TEXT NOT NULL,
  option_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (poll_id, respondent_key)
);

COMMIT;
