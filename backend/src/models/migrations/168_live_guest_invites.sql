-- Canlı dərs qonaq dəvəti və iştirakçıları (users cədvəlindən ayrı)

BEGIN;

CREATE TABLE IF NOT EXISTS live_guest_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES live_rooms(id) ON DELETE CASCADE,
  token VARCHAR(64) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_guest_invites_room ON live_guest_invites (room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_guest_invites_token ON live_guest_invites (token);

CREATE TABLE IF NOT EXISTS live_guest_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invite_id UUID NOT NULL REFERENCES live_guest_invites(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES live_rooms(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone_number VARCHAR(32) NOT NULL,
  livekit_identity VARCHAR(80) NOT NULL,
  join_ip VARCHAR(64),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  duration_minutes INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_live_guest_participants_identity
  ON live_guest_participants (livekit_identity);

CREATE INDEX IF NOT EXISTS idx_live_guest_participants_room_active
  ON live_guest_participants (room_id, joined_at DESC)
  WHERE left_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_live_guest_participants_room_all
  ON live_guest_participants (room_id, joined_at DESC);

COMMIT;
