-- Mentorix Live: canlı dərs otaqları və iştirak sessiyaları

BEGIN;

CREATE TABLE IF NOT EXISTS live_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_code VARCHAR(12) UNIQUE NOT NULL,
  instructor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id UUID NULL REFERENCES instructor_groups(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'live', 'ended')),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  participant_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_rooms_instructor ON live_rooms (instructor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_rooms_group ON live_rooms (group_id) WHERE group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_live_rooms_code ON live_rooms (room_code);

CREATE TABLE IF NOT EXISTS live_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES live_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  duration_minutes INTEGER
);

CREATE INDEX IF NOT EXISTS idx_live_sessions_room ON live_sessions (room_id, joined_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_sessions_user ON live_sessions (user_id, joined_at DESC);

COMMIT;
